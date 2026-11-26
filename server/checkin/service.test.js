import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { Buffer } from 'node:buffer'
import axios from 'axios'
import Koa from 'koa'
import Router from 'koa-router'
import { koaBody } from 'koa-body'
import { CheckinService, nextRun, shanghaiDate, recordName, registerCheckinRoutes } from './service.js'
import { CheckinError, LaowangClient, parsePage, parseCookieHeader, buildPayload } from './laowang.js'

const cookie = 'X9wU_2132_auth=private-test-auth; X9wU_2132_saltkey=private-test-salt'
const fingerprint = 'a'.repeat(32)
const account = 'mmzhw51'
const before = { lxtdays: 236, lxdays: 8, lxreward: 6, lxlevel: 7 }
const after = { lxtdays: 237, lxdays: 9, lxreward: 4, lxlevel: 7 }
async function fixture(t, { execute, clock = () => new Date('2026-11-24T00:00:00Z') } = {}) {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-req-checkin-'))
    t.after(() => {
        const resolved = path.resolve(dataDir)
        assert.equal(path.dirname(resolved), path.resolve(os.tmpdir()))
        assert.ok(path.basename(resolved).startsWith('game-req-checkin-'))
        return fs.rm(resolved, { recursive: true, force: true })
    })
    const calls = { execute: 0, posts: 0, inspect: 0 }
    const clientFactory = () => ({
        cookieHeader: () => cookie,
        close() {},
        inspect: async () => {
            calls.inspect++
            return { account, signed: true, counters: after }
        },
        execute: async (hooks) => {
            calls.execute++
            if (execute) return execute(hooks, calls)
            await hooks.beforePost()
            calls.posts++
            return { status: 'success', message: '签到成功', before, after, checkinPosts: 1 }
        }
    })
    const service = await new CheckinService({ dataDir, clock, clientFactory }).init()
    await service.saveConfig({ enabled: true, time: '08:00', account, cookie, fingerprint, proxy: '' })
    return { service, calls, dataDir, clientFactory, clock }
}

test('FNAT scheduling keeps draw submission and unknown outcomes separate from signup across restarts', async (t) => {
    const { dataDir } = await fixture(t)
    let now = new Date('2026-11-23T23:59:00Z')
    let signPosts = 0
    let drawPosts = 0
    const options = {
        dataDir,
        clock: () => now,
        site: { id: 'fnat', name: 'FNAT', url: 'https://frp.fnat.cc', requiresFingerprint: false, parseCookie: parseCookieHeader, supportsLottery: true },
        clientFactory: () => ({
            cookieHeader: () => cookie,
            close() {},
            async execute({ beforePost }) {
                await beforePost()
                signPosts++
                return { status: 'success', checkinPosts: 1 }
            },
            async draw({ beforePost }) {
                await beforePost()
                drawPosts++
                throw new Error('timeout')
            }
        })
    }
    const service = await new CheckinService(options).init()
    assert.equal((await service.state()).lottery.enabled, false)
    await service.saveConfig({ enabled: true, time: '08:00', account, cookie, lotteryEnabled: true })
    now = new Date('2026-11-24T00:00:01Z')
    await service.tick()
    const restarted = await new CheckinService(options).init()
    await restarted.tick()
    assert.equal(signPosts, 1)
    assert.equal(drawPosts, 1)
    assert.equal((await restarted.run('manual', true)).duplicate, true)
    const state = await restarted.state()
    assert.equal(state.records[0].status, 'success')
    assert.equal(state.lottery.records[0].status, 'unconfirmed')
    assert.equal(state.runtime.nextRunAt, '2026-11-25T00:00:00.000Z')

    now = new Date('2026-11-24T00:01:00Z')
    const refreshed = await restarted.saveConfig({ enabled: true, time: '08:00', account, cookie: cookie.replace('private-test-auth', 'refreshed-auth'), lotteryEnabled: true })
    assert.equal(refreshed.lottery.todayClaimed, true)
    assert.equal((await restarted.run('manual', true)).duplicate, true)
    assert.equal(drawPosts, 1)
})

test('FNAT allows only a manual draw retry after a zero-submission session failure and Cookie save', async (t) => {
    const { dataDir } = await fixture(t)
    let now = new Date('2026-11-23T23:59:00Z')
    let submissions = 0
    const freshCookie = cookie.replace('private-test-auth', 'refreshed-auth')
    const options = {
        dataDir,
        clock: () => now,
        site: { id: 'fnat', name: 'FNAT', url: 'https://frp.fnat.cc', requiresFingerprint: false, parseCookie: parseCookieHeader, supportsLottery: true },
        clientFactory: (config) => ({
            cookieHeader: () => config.cookie,
            close() {},
            async draw({ beforePost }) {
                if (config.cookie === cookie) throw new CheckinError('SESSION_EXPIRED', '过期')
                await beforePost()
                submissions++
                return { status: 'success', message: '抽奖完成', checkinPosts: 1 }
            }
        })
    }
    const settings = { enabled: true, time: '08:00', account, lotteryEnabled: true }
    const service = await new CheckinService(options).init()
    await service.saveConfig({ ...settings, cookie })
    now = new Date('2026-11-24T00:00:01Z')
    const failed = (await service.run('manual', true)).record
    assert.equal(failed.code, 'SESSION_EXPIRED')
    assert.equal(failed.checkinPosts, 0)
    assert.equal((await service.state()).lottery.todayClaimed, true)
    assert.equal((await service.run('manual', true)).duplicate, true)
    now = new Date('2026-11-24T00:01:00Z')
    assert.equal((await service.saveConfig({ ...settings, cookie: '' })).lottery.todayClaimed, true)
    assert.equal((await service.saveConfig({ ...settings, cookie: freshCookie })).lottery.todayClaimed, false)
    assert.equal((await service.run('scheduled', true)).duplicate, true)
    const restarted = await new CheckinService(options).init()
    assert.equal((await restarted.state()).lottery.todayClaimed, false)
    const attempts = await Promise.all([restarted.run('manual', true), service.run('manual', true)])
    assert.equal(attempts.filter((result) => !result.duplicate).length, 1)
    assert.equal(submissions, 1)
    assert.equal((await restarted.state()).lottery.todayClaimed, true)
})

test('Shanghai 08:00 schedule uses the next morning when enabled after the time', () => {
    const config = { enabled: true, cookie, time: '08:00', activatedAt: '2026-11-23T09:50:00Z' }
    assert.equal(shanghaiDate(new Date('2026-11-23T16:01:00Z')), '2026-11-24')
    assert.equal(nextRun(config, new Date('2026-11-23T09:50:00Z'), false), '2026-11-24T00:00:00.000Z')
    assert.equal(nextRun(config, new Date('2026-11-24T00:01:00Z'), false), '2026-11-24T00:00:00.000Z')
    assert.equal(nextRun(config, new Date('2026-11-24T00:01:00Z'), true), '2026-11-25T00:00:00.000Z')
})

test('random plan stays in range, catches up after restart, and advances after execution', async (t) => {
    let now = new Date('2026-11-24T00:00:00Z')
    const { service, calls, dataDir, clientFactory, clock } = await fixture(t, { clock: () => now })
    const config = { enabled: true, time: '08:00', account, scheduleMode: 'random', randomStart: '09:00', randomEnd: '09:30' }
    const first = (await service.saveConfig(config)).runtime.nextRunAt
    assert.ok(first >= '2026-11-24T01:00:00.000Z' && first <= '2026-11-24T01:30:00.000Z')
    assert.equal((await service.saveConfig({ ...config, cookie })).runtime.nextRunAt, first)
    now = new Date(Date.parse(first) - 1000)
    await service.tick()
    assert.equal(calls.posts, 0)
    now = new Date(Date.parse(first) + 1000)
    const restarted = await new CheckinService({ dataDir, clientFactory, clock }).init()
    assert.equal((await restarted.siteSummary()).nextRunAt, first)
    await restarted.tick()
    await restarted.tick()
    assert.equal(calls.posts, 1)
    const next = (await restarted.state()).runtime.nextRunAt
    assert.ok(next >= '2026-11-25T01:00:00.000Z' && next <= '2026-11-25T01:30:00.000Z')
    const again = await new CheckinService({ dataDir, clientFactory, clock }).init()
    assert.equal((await again.siteSummary()).nextRunAt, next)
})

test('random mode validates its window and keeps the prior fixed time', async (t) => {
    const { service } = await fixture(t, { clock: () => new Date('2026-11-24T03:00:00Z') })
    const config = { enabled: true, time: '08:00', account, scheduleMode: 'random', randomStart: '09:00', randomEnd: '10:00' }
    const random = await service.saveConfig(config)
    assert.equal(random.runtime.nextRunAt.slice(0, 10), '2026-11-25')
    await assert.rejects(() => service.saveConfig({ ...config, randomEnd: '08:00' }), { code: 'CONFIG_INVALID' })
    const fixed = await service.saveConfig({ ...config, scheduleMode: 'fixed' })
    assert.equal(fixed.runtime.nextRunAt, '2026-11-25T00:00:00.000Z')
})

test('saved fixed-time configs from older releases need no migration', async (t) => {
    const { service, dataDir, clock, clientFactory } = await fixture(t)
    const config = { ...service.config }
    for (const key of ['scheduleMode', 'randomStart', 'randomEnd', 'scheduleSeed']) delete config[key]
    await fs.writeFile(path.join(dataDir, 'config.json'), JSON.stringify(config))
    const restarted = await new CheckinService({ dataDir, clock, clientFactory }).init()
    const state = await restarted.state()
    assert.equal(state.config.scheduleMode, 'fixed')
    assert.equal(state.runtime.nextRunAt, '2026-11-24T00:00:00.000Z')
})

test('exclusive per-account/day lock prevents parallel and restarted POSTs', async (t) => {
    const { service, calls, dataDir, clientFactory, clock } = await fixture(t)
    const second = await new CheckinService({ dataDir, clientFactory, clock }).init()
    const results = await Promise.all([service.run(), second.run()])
    assert.equal(calls.posts, 1)
    assert.equal(results.filter((result) => result.duplicate).length, 1)
    const restarted = await new CheckinService({ dataDir, clientFactory, clock }).init()
    assert.equal((await restarted.run()).duplicate, true)
    assert.equal(calls.posts, 1)
})

test('unknown POST outcome stays locked across restarts', async (t) => {
    const { service, calls, dataDir, clientFactory, clock } = await fixture(t, {
        execute: async (hooks, counter) => {
            await hooks.beforePost()
            counter.posts++
            throw new CheckinError('NETWORK', '站点请求超时')
        }
    })
    const result = await service.run()
    assert.equal(result.record.status, 'unconfirmed')
    assert.equal(result.record.checkinPosts, 1)
    const restarted = await new CheckinService({ dataDir, clientFactory, clock }).init()
    assert.equal((await restarted.run()).duplicate, true)
    assert.equal(calls.posts, 1)
})

test('final request trace records the actual redirect and empty body without credentials', async (t) => {
    const action = '/plugin.php?id=k_misign:sign&operation=qiandao&formhash=secret987'
    const data = new URLSearchParams({ 'clicaptcha-submit-info': 'private-test-verification', fingerprint }).toString()
    const client = new LaowangClient({ cookie, fingerprint })
    const originalAdapter = axios.defaults.adapter
    t.after(() => {
        axios.defaults.adapter = originalAdapter
        client.close()
    })
    let calls = 0
    axios.defaults.adapter = async (config) => {
        calls++
        assert.equal(config.method, 'post')
        assert.equal(new URL(config.url).searchParams.get('formhash'), 'secret987')
        assert.equal(config.data, data)
        assert.equal(config.headers.get('Cookie'), cookie)
        return { status: 302, headers: { location: '/sign.php', 'content-type': 'text/html', 'set-cookie': ['sid=server-private'] }, data: Buffer.alloc(0), config }
    }
    await client.request(action, { method: 'POST', data, final: true })
    const trace = client.submissionTrace
    assert.deepEqual(trace.request, { method: 'POST', url: 'https://laowang.vip/plugin.php?id=k_misign:sign&operation=qiandao&formhash=[已隐藏]', contentType: 'application/x-www-form-urlencoded', fields: ['clicaptcha-submit-info', 'fingerprint'] })
    assert.deepEqual(trace.response, { status: 302, location: 'https://laowang.vip/sign.php', contentType: 'text/html', body: { bytes: 0, kind: 'empty' } })
    for (const secret of ['secret987', 'private-test-auth', 'private-test-verification', fingerprint, 'server-private']) assert.ok(!JSON.stringify(trace).includes(secret))
    await assert.rejects(() => client.request(action, { method: 'POST', data, final: true }), { code: 'DUPLICATE_POST' })
    assert.equal(calls, 1)
})

test('blocked submission persists sanitized response and step diagnostics across restart', async (t) => {
    const action = '/plugin.php?id=k_misign:sign&operation=qiandao&formhash=secret987'
    const originalAdapter = axios.defaults.adapter
    t.after(() => {
        axios.defaults.adapter = originalAdapter
    })
    axios.defaults.adapter = async (config) => ({
        status: 403,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
        data: Buffer.from('请求被拒绝：private-test-auth / secret987'),
        config
    })
    const { service, dataDir, clock } = await fixture(t)
    service.clientFactory = (config) => {
        const client = new LaowangClient(config)
        client.execute = async ({ beforePost }) => {
            await beforePost()
            await client.step('submit', () => client.request(action, { method: 'POST', data: 'fingerprint=' + fingerprint, final: true }))
        }
        return client
    }
    const result = await service.run()
    const persisted = JSON.parse(await fs.readFile(path.join(dataDir, 'runs', recordName(account, '2026-11-24')), 'utf8'))
    assert.equal(result.record.status, 'unconfirmed')
    assert.equal(persisted.submissionTrace.response.status, 403)
    assert.equal(persisted.submissionTrace.response.body.text, '请求被拒绝：[已隐藏] / [已隐藏]')
    assert.equal(persisted.network, 'direct')
    assert.equal(persisted.diagnostics.length, 1)
    assert.match(persisted.diagnostics[0].startedAt, /^\d{4}-\d{2}-\d{2}T/)
    assert.ok(persisted.diagnostics[0].durationMs >= 0)
    assert.equal(persisted.diagnostics[0].httpStatus, 403)
    assert.equal(persisted.diagnostics[0].code, 'ACCESS_BLOCKED')
    assert.equal(persisted.diagnostics[0].outcome, 'error')
    const restarted = await new CheckinService({ dataDir, clock, clientFactory: service.clientFactory }).init()
    assert.deepEqual((await restarted.state()).records[0], persisted)
    assert.equal((await restarted.run()).duplicate, true)
})

test('initial login check records its failure and HTTP response without a submission', async (t) => {
    const client = new LaowangClient({ account, cookie, fingerprint })
    t.after(() => client.close())
    client.request = async () => ({ status: 200, text: '<html>请登录</html>' })
    await assert.rejects(() => client.execute({ beforePost: () => assert.fail('unexpected submission') }), { code: 'AUTH_REQUIRED' })
    assert.deepEqual(
        client.diagnostics.map(({ name, httpStatus, outcome, code }) => ({ name, httpStatus, outcome, code })),
        [{ name: 'initial_state', httpStatus: 200, outcome: 'error', code: 'AUTH_REQUIRED' }]
    )
    assert.equal(client.submissionTrace, null)
})

test('final request trace distinguishes a timeout from a response and omits HTML containing session data', async (t) => {
    const action = '/plugin.php?id=k_misign:sign&operation=qiandao&formhash=secret987'
    const originalAdapter = axios.defaults.adapter
    t.after(() => {
        axios.defaults.adapter = originalAdapter
    })
    const timeoutClient = new LaowangClient({ cookie, fingerprint })
    const htmlClient = new LaowangClient({ cookie, fingerprint })
    t.after(() => {
        timeoutClient.close()
        htmlClient.close()
    })
    axios.defaults.adapter = async () => {
        throw Object.assign(new Error('hidden-adapter-message'), { code: 'ECONNABORTED' })
    }
    await assert.rejects(() => timeoutClient.request(action, { method: 'POST', final: true }), { code: 'NETWORK' })
    assert.equal(timeoutClient.submissionTrace.error, '站点请求超时')
    assert.equal(timeoutClient.submissionTrace.response, undefined)
    axios.defaults.adapter = async (config) => ({
        status: 200,
        headers: { 'content-type': 'text/html' },
        data: Buffer.from('<input type="hidden" value="server-private">'),
        config
    })
    await htmlClient.request(action, { method: 'POST', final: true })
    assert.equal(htmlClient.submissionTrace.response.body.kind, 'omitted')
    assert.ok(!JSON.stringify(htmlClient.submissionTrace).includes('server-private'))
})

test('forum retries a pre-submit failure at the next hour, including after restart', async (t) => {
    let now = new Date('2026-11-24T00:00:00Z')
    const { service, calls, dataDir, clientFactory, clock } = await fixture(t, {
        clock: () => now,
        execute: async ({ beforePost }, counter) => {
            if (counter.execute < 3) throw new CheckinError('ACCESS_BLOCKED', '站点拒绝访问')
            await beforePost()
            counter.posts++
            return { status: 'success', checkinPosts: 1 }
        }
    })
    now = new Date('2026-11-24T01:53:01Z')
    await service.tick()
    const first = await service.state()
    assert.equal(first.records[0].checkinPosts, 0)
    assert.equal(first.runtime.retryAvailable, true)
    assert.equal(first.runtime.nextRunAt, '2026-11-24T02:00:00.000Z')
    // Existing records from the previous release have no attempt ID.
    const legacy = { ...first.records[0] }
    delete legacy.attemptId
    await fs.writeFile(path.join(dataDir, 'runs', recordName(account, '2026-11-24')), JSON.stringify(legacy))
    const restarted = await new CheckinService({ dataDir, clientFactory, clock }).init()
    now = new Date('2026-11-24T01:59:59Z')
    await restarted.tick()
    assert.equal(calls.execute, 1)
    now = new Date('2026-11-24T02:00:00Z')
    await restarted.tick()
    assert.equal(calls.execute, 2)
    assert.equal((await restarted.state()).runtime.nextRunAt, '2026-11-24T03:00:00.000Z')
    now = new Date('2026-11-24T03:00:00Z')
    await Promise.all([service.tick(), restarted.run()])
    assert.equal(calls.posts, 1)
    assert.equal((await service.state()).runtime.nextRunAt, '2026-11-25T00:00:00.000Z')
    assert.equal((await service.run()).duplicate, true)
})

test('forum can retry manually before the hour, but never carries a retry across midnight', async (t) => {
    let now = new Date('2026-11-24T00:00:00Z')
    const { service, calls } = await fixture(t, {
        clock: () => now,
        execute: async () => {
            throw new CheckinError('ACCESS_BLOCKED', '站点拒绝访问')
        }
    })
    now = new Date('2026-11-24T15:53:01Z')
    assert.equal((await service.run()).record.status, 'failed')
    const state = await service.state()
    assert.equal(state.runtime.retryAvailable, true)
    assert.equal(state.runtime.nextIsRetry, false)
    assert.equal(state.runtime.nextRunAt, '2026-11-25T00:00:00.000Z')
    assert.equal((await service.run()).duplicate, false)
    now = new Date('2026-11-24T16:00:00Z')
    await service.tick()
    assert.equal(calls.execute, 2)
    assert.equal(calls.posts, 0)
})

test('already-signed state is recorded without a POST', async (t) => {
    const { service, calls } = await fixture(t, { execute: async () => ({ status: 'already_signed', message: '今日已签到', before: after, after, checkinPosts: 0 }) })
    assert.equal((await service.run()).record.status, 'already_signed')
    assert.equal(calls.posts, 0)
})

test('scheduler catches up after restart, but does not run early or repeat', async (t) => {
    let now = new Date('2026-11-23T23:59:50Z')
    const { service, calls } = await fixture(t, { clock: () => now })
    await service.tick()
    assert.equal(calls.posts, 0)
    now = new Date('2026-11-24T00:00:00Z')
    await service.tick()
    await service.tick()
    assert.equal(calls.posts, 1)
    assert.equal((await service.state()).runtime.nextRunAt, '2026-11-25T00:00:00.000Z')
})

test('read-only inspection and state responses never reveal saved secrets', async (t) => {
    const { service, calls } = await fixture(t)
    const inspected = await service.inspect()
    assert.equal(inspected.account, account)
    assert.equal(calls.posts, 0)
    assert.equal((await service.state()).records.length, 0)
    const json = JSON.stringify(await service.state())
    assert.ok(!json.includes('private-test-auth'))
    assert.ok(!json.includes(fingerprint))
    assert.equal((await service.state()).config.hasCookie, true)
})

test('a durable lock without a record fails closed after an interrupted start', async (t) => {
    const { service, calls, dataDir } = await fixture(t)
    await fs.writeFile(path.join(dataDir, 'runs', recordName(account, '2026-11-24') + '.lock'), '')
    const result = await service.run()
    assert.equal(result.duplicate, true)
    assert.equal(calls.execute, 0)
    assert.equal((await service.state()).runtime.todayClaimed, true)
})

test('saving an empty Cookie preserves the configured credential', async (t) => {
    const { service } = await fixture(t)
    await service.saveConfig({ enabled: true, time: '08:00', account, cookie: '', proxy: '' })
    assert.equal(service.config.cookie, cookie)
    await assert.rejects(() => service.saveConfig({ enabled: true, time: '25:00', account, cookie, proxy: '' }), { code: 'CONFIG_INVALID' })
    assert.throws(() => parseCookieHeader('X9wU_2132_auth=value'), { code: 'COOKIE_INVALID' })
})

test('password login mode is opt-in and never exposes the saved password', async (t) => {
    const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-req-password-checkin-'))
    t.after(() => fs.rm(dataDir, { recursive: true, force: true }))
    const service = await new CheckinService({
        dataDir,
        site: { id: 'fnat-test', name: 'FNAT', url: 'https://frp.fnat.cc', requiresFingerprint: false, supportsPassword: true, parseCookie: () => new Map() },
        clientFactory: (config) => ({
            cookieHeader: () => 'PHPSESSID=renewed-session',
            close() {},
            inspect: async () => ({ account: config.account, signed: false, counters: null })
        })
    }).init()
    await assert.rejects(() => service.saveConfig({ enabled: true, time: '08:00', account, authMode: 'password', password: 'private-password', allowInsecureLogin: false, proxy: '' }), { code: 'CONFIG_INVALID' })
    const state = await service.saveConfig({ enabled: true, time: '08:00', account, authMode: 'password', password: 'private-password', allowInsecureLogin: true, proxy: '' })
    assert.equal(state.config.authMode, 'password')
    assert.equal(state.config.hasPassword, true)
    assert.equal(state.config.credentialsReady, true)
    assert.ok(state.runtime.nextRunAt)
    assert.doesNotMatch(JSON.stringify(state), /private-password/)
    await service.inspect()
    assert.equal(service.config.cookie, 'PHPSESSID=renewed-session')
})

test('page parsing validates account, counters and signed state before acting', () => {
    const stats = Object.entries(before)
        .map(([key, value]) => '<input id="' + key + '" value="' + value + '">')
        .join('')
    const html = '<script>var discuz_uid = "123";</script><a class="author">mmzhw51</a>' + stats
    assert.equal(parsePage(html + '<span class="btn btnvisted"></span>', account).signed, true)
    assert.throws(() => parsePage(html, account), { code: 'PAGE_CHANGED' })
    assert.throws(() => parsePage(html + '<span class="btn btnvisted"></span>', 'another-user'), { code: 'AUTH_REQUIRED' })
    assert.throws(() => parsePage(html + '<a class="btn J_chkitot" href="https://example.com/plugin.php?operation=qiandao"></a>', account), { code: 'PAGE_CHANGED' })
})

test('CAPTCHA payload has stable timing and uses the expected form fields', () => {
    const payload = buildPayload(59, 1700000000000)
    const fields = new URLSearchParams(payload.data)
    assert.equal(payload.duration, 777)
    assert.equal(fields.get('tn_r'), '59.00')
    assert.equal(fields.get('ts'), '1700000000000')
    assert.match(fields.get('sign'), /^[a-f0-9]+$/)
    assert.ok(fields.get('track').length > 100)
})

test('HTTP config API hides secrets and rejects writes from a foreign origin', async (t) => {
    const { service, calls } = await fixture(t)
    const app = new Koa(),
        router = new Router()
    registerCheckinRoutes(router, service)
    app.use(koaBody()).use(router.routes())
    const server = http.createServer(app.callback())
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    t.after(() => new Promise((resolve) => server.close(resolve)))
    const base = 'http://127.0.0.1:' + server.address().port
    const state = await (await fetch(base + '/api/checkin')).json()
    assert.ok(!JSON.stringify(state).includes('private-test-auth'))
    const sites = await (await fetch(base + '/api/checkin/sites')).json()
    assert.deepEqual(sites, [{ id: 'laowang', name: '老王论坛', site: 'https://laowang.vip', enabled: true, scheduleMode: 'fixed', running: false, nextRunAt: state.runtime.nextRunAt }])
    const denied = await fetch(base + '/api/checkin/run', { method: 'POST', headers: { Origin: 'https://foreign.example' } })
    assert.equal(denied.status, 403)
    assert.equal(calls.execute, 0)
    const inspected = await fetch(base + '/api/checkin/inspect', { method: 'POST' })
    assert.equal(inspected.status, 200)
    assert.equal(calls.posts, 0)
})
