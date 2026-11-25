import process from 'node:process'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash, randomUUID } from 'node:crypto'
import { LaowangClient, CheckinError, parseCookieHeader, SITE } from './laowang.js'

export const TIME_ZONE = 'Asia/Shanghai'
export const DEFAULT_DATA_DIR = fileURLToPath(new URL('../data/checkin/', import.meta.url))
export function shanghaiDate(now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}
export function scheduledAt(date, time) {
    return new Date(date + 'T' + time + ':00+08:00')
}
function tomorrow(date) {
    return shanghaiDate(new Date(scheduledAt(date, '00:00').getTime() + 86400000))
}
const isTime = (value) => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value)
const toMinutes = (time) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
function dailyDue(config, date) {
    if (config.scheduleMode !== 'random') return scheduledAt(date, config.time)
    const start = toMinutes(config.randomStart)
    const end = toMinutes(config.randomEnd)
    // Keep the draw for each date stable across restarts and Cookie updates.
    const draw = createHash('sha256').update(`${config.scheduleSeed}|${date}`).digest().readUInt32BE()
    return new Date(scheduledAt(date, '00:00').getTime() + (start + (draw % (end - start + 1))) * 60000)
}
export function nextRun(config, now, alreadyClaimed) {
    if (!config.enabled || !config.cookie) return null
    const date = shanghaiDate(now),
        due = dailyDue(config, date)
    return (alreadyClaimed || new Date(config.activatedAt || now) > due ? dailyDue(config, tomorrow(date)) : due).toISOString()
}
export function recordName(account, date) {
    return (
        createHash('sha256')
            .update(SITE + '|' + account)
            .digest('hex')
            .slice(0, 20) +
        '-' +
        date +
        '.json'
    )
}
const defaults = { enabled: false, time: '08:00', scheduleMode: 'fixed', randomStart: '08:00', randomEnd: '10:00', scheduleSeed: '', timeZone: TIME_ZONE, account: 'mmzhw51', cookie: '', fingerprint: '', proxy: '', activatedAt: null, credentialsUpdatedAt: null }
async function atomicWrite(file, value) {
    const temp = file + '.' + randomUUID() + '.tmp'
    const handle = await fs.open(temp, 'wx', 0o600)
    try {
        await handle.writeFile(JSON.stringify(value, null, 2) + '\n')
        await handle.sync()
    } finally {
        await handle.close()
    }
    await fs.rename(temp, file)
}

export class CheckinService {
    constructor({ dataDir = process.env.CHECKIN_DATA_DIR || DEFAULT_DATA_DIR, clientFactory = (config) => new LaowangClient(config), clock = () => new Date(), site = { id: 'laowang', name: '老王论坛', url: SITE, requiresFingerprint: true, parseCookie: parseCookieHeader } } = {}) {
        this.site = site
        this.dataDir = site.id === 'laowang' ? dataDir : path.join(dataDir, site.id)
        this.runsDir = path.join(this.dataDir, 'runs')
        this.configFile = path.join(this.dataDir, 'config.json')
        this.clientFactory = clientFactory
        this.clock = clock
        this.config = { ...defaults }
        this.running = false
        this.timer = null
        this.writeQueue = Promise.resolve()
        this.startedAt = clock().toISOString()
    }
    async init() {
        await fs.mkdir(this.runsDir, { recursive: true, mode: 0o700 })
        try {
            this.config = { ...defaults, ...JSON.parse(await fs.readFile(this.configFile, 'utf8')) }
        } catch (error) {
            if (error.code !== 'ENOENT') throw error
        }
        return this
    }
    persistConfig() {
        this.writeQueue = this.writeQueue.catch(() => {}).then(() => atomicWrite(this.configFile, this.config))
        return this.writeQueue
    }
    async saveConfig(input) {
        if (!input || typeof input !== 'object' || typeof input.enabled !== 'boolean' || !isTime(input.time)) throw new CheckinError('CONFIG_INVALID', '请选择每天执行时间，并设置自动签到开关')
        const { scheduleMode = this.config.scheduleMode, randomStart = this.config.randomStart, randomEnd = this.config.randomEnd } = input
        if (!['fixed', 'random'].includes(scheduleMode)) throw new CheckinError('CONFIG_INVALID', '请选择固定时间或每日随机')
        if (!isTime(randomStart) || !isTime(randomEnd) || randomStart >= randomEnd) throw new CheckinError('CONFIG_INVALID', '随机时间段的结束时间必须晚于开始时间（不跨天）')
        const account = String(input.account || '').trim()
        if (!account || account.length > 64 || /[\r\n<>]/.test(account)) throw new CheckinError('CONFIG_INVALID', '请填写有效的站点用户名')
        const proxy = String(input.proxy || '').trim()
        if (proxy) {
            let url
            try {
                url = new URL(proxy)
            } catch {
                throw new CheckinError('CONFIG_INVALID', '代理地址格式不正确')
            }
            if (!['http:', 'https:'].includes(url.protocol) || url.hash || url.search) throw new CheckinError('CONFIG_INVALID', '代理需使用 http:// 或 https:// 地址')
        }
        let cookie = this.config.cookie,
            fingerprint = this.config.fingerprint
        if (typeof input.cookie === 'string' && input.cookie.trim()) cookie = [...this.site.parseCookie(input.cookie.trim())].map(([key, value]) => key + '=' + value).join('; ')
        if (input.fingerprint !== undefined) {
            if (!/^[a-f0-9]{32}$/i.test(input.fingerprint)) throw new CheckinError('CONFIG_INVALID', '浏览器标识格式不正确')
            fingerprint = input.fingerprint
        }
        if (input.enabled && (!cookie || (this.site.requiresFingerprint && !fingerprint))) throw new CheckinError('CONFIG_INVALID', '请先保存完整的登录信息')
        const now = this.clock().toISOString()
        const scheduleChanged = scheduleMode !== this.config.scheduleMode || (scheduleMode === 'fixed' ? input.time !== this.config.time : randomStart !== this.config.randomStart || randomEnd !== this.config.randomEnd)
        const newActivation = input.enabled && (!this.config.enabled || scheduleChanged || account !== this.config.account)
        const scheduleSeed = this.config.scheduleSeed || (scheduleMode === 'random' ? randomUUID() : '')
        this.config = { ...this.config, enabled: input.enabled, time: input.time, scheduleMode, randomStart, randomEnd, scheduleSeed, account, proxy, cookie, fingerprint, timeZone: TIME_ZONE, activatedAt: newActivation ? now : this.config.activatedAt, credentialsUpdatedAt: input.cookie?.trim() ? now : this.config.credentialsUpdatedAt, updatedAt: now }
        await this.persistConfig()
        return this.state()
    }
    async readRecord(account, date) {
        const file = path.join(this.runsDir, recordName(account, date))
        try {
            return JSON.parse(await fs.readFile(file, 'utf8'))
        } catch (error) {
            if (error.code !== 'ENOENT') throw error
            try {
                const stat = await fs.stat(file + '.lock')
                return { date, account, status: 'running', phase: 'reserved', source: 'scheduled', startedAt: stat.birthtime.toISOString(), checkinPosts: 0, message: '已有执行锁，等待结果确认' }
            } catch (lockError) {
                if (lockError.code === 'ENOENT') return null
                throw lockError
            }
        }
    }
    async history() {
        const records = await Promise.all((await fs.readdir(this.runsDir)).filter((name) => name.endsWith('.json')).map(async (name) => JSON.parse(await fs.readFile(path.join(this.runsDir, name), 'utf8'))))
        return records
            .filter((record) => record.account === this.config.account)
            .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
            .slice(0, 30)
    }
    async scheduleState(config, now) {
        const today = await this.readRecord(config.account, shanghaiDate(now))
        return { running: this.running, nextRunAt: nextRun(config, now, !!today), todayClaimed: !!today }
    }
    async state() {
        const { enabled, time, scheduleMode, randomStart, randomEnd, account, cookie, fingerprint, credentialsUpdatedAt, proxy } = this.config
        const now = this.clock()
        const runtime = await this.scheduleState(this.config, now)
        return {
            config: { enabled, time, scheduleMode, randomStart, randomEnd, timeZone: TIME_ZONE, account, site: this.site.url, hasCookie: !!cookie, hasFingerprint: !!fingerprint, credentialsUpdatedAt, proxy },
            runtime: { ...runtime, schedulerActive: !!this.timer, serverTime: now.toISOString(), serverStartedAt: this.startedAt },
            records: await this.history()
        }
    }
    async siteSummary() {
        const config = this.config
        const { running, nextRunAt } = await this.scheduleState(config, this.clock())
        return { id: this.site.id, name: this.site.name, site: this.site.url, enabled: config.enabled, scheduleMode: config.scheduleMode, running, nextRunAt }
    }
    async saveSession(client, revision) {
        if (this.config.credentialsUpdatedAt === revision) {
            this.config.cookie = client.cookieHeader()
            await this.persistConfig()
        }
    }
    async inspect() {
        if (this.running) throw new CheckinError('BUSY', '正在签到，请稍后检查登录态')
        const revision = this.config.credentialsUpdatedAt,
            client = this.clientFactory({ ...this.config })
        try {
            const result = await client.inspect()
            await this.saveSession(client, revision)
            return { account: result.account, signed: result.signed, counters: result.counters, checkedAt: this.clock().toISOString() }
        } finally {
            client.close()
        }
    }
    async run(source = 'manual') {
        if (this.running) throw new CheckinError('BUSY', '已有签到任务正在执行')
        const config = { ...this.config },
            date = shanghaiDate(this.clock())
        if (!config.cookie || (this.site.requiresFingerprint && !config.fingerprint)) throw new CheckinError('CONFIG_INVALID', '请先保存完整的登录信息')
        this.running = true
        const file = path.join(this.runsDir, recordName(config.account, date))
        let record, client
        try {
            let lock
            try {
                lock = await fs.open(file + '.lock', 'wx', 0o600)
            } catch (error) {
                if (error.code === 'EEXIST') return { duplicate: true, record: await this.readRecord(config.account, date), message: '今日已有执行记录，已阻止重复签到' }
                throw error
            }
            record = { date, account: config.account, source, network: config.proxy ? 'proxy' : 'direct', status: 'running', phase: 'reserved', startedAt: this.clock().toISOString(), checkinPosts: 0, message: '正在检查登录态和签到状态' }
            try {
                await lock.writeFile(JSON.stringify({ date, account: config.account, startedAt: record.startedAt }))
                await lock.sync()
            } finally {
                await lock.close()
            }
            await atomicWrite(file, record)
            client = this.clientFactory(config)
            let result
            try {
                result = await client.execute({
                    beforePost: async () => {
                        if (shanghaiDate(this.clock()) !== date) throw new CheckinError('DATE_CHANGED', '日期已变化，已停止提交')
                        // Persist before the only final POST so restarts cannot send it twice.
                        record.phase = 'post_reserved'
                        record.checkinPosts = 1
                        record.message = '已保留本次提交，正在确认结果'
                        if (client.diagnostics?.length) record.diagnostics = [...client.diagnostics]
                        await atomicWrite(file, record)
                    }
                })
            } finally {
                if (client.submissionTrace) record.submissionTrace = client.submissionTrace
                if (client.diagnostics?.length) record.diagnostics = client.diagnostics
            }
            Object.assign(record, result, { phase: 'finished', finishedAt: this.clock().toISOString() })
            await atomicWrite(file, record)
            await this.saveSession(client, config.credentialsUpdatedAt)
            return { duplicate: false, record }
        } catch (error) {
            if (!record) throw error
            record.status = record.checkinPosts ? 'unconfirmed' : 'failed'
            record.phase = 'finished'
            record.finishedAt = this.clock().toISOString()
            record.code = error instanceof CheckinError ? error.code : 'INTERNAL'
            record.message = error instanceof CheckinError ? error.message : '签到服务异常，请查看服务日志'
            await atomicWrite(file, record)
            return { duplicate: false, record }
        } finally {
            client?.close()
            this.running = false
        }
    }
    async tick() {
        const config = this.config
        if (this.running || !config.enabled || !config.cookie || (this.site.requiresFingerprint && !config.fingerprint)) return
        const now = this.clock(),
            date = shanghaiDate(now),
            due = dailyDue(config, date)
        if (now < due || new Date(config.activatedAt || now) > due || (await this.readRecord(config.account, date))) return
        if (this.running || this.config !== config || shanghaiDate(this.clock()) !== date) return
        const result = await this.run('scheduled')
        console.log('[CHECKIN]', date, result.record?.status, result.record?.message)
    }
    start() {
        if (this.timer) return
        this.tick().catch((error) => console.error('[CHECKIN] scheduler:', error.code || error.name))
        this.timer = setInterval(() => this.tick().catch((error) => console.error('[CHECKIN] scheduler:', error.code || error.name)), 10000)
    }
    stop() {
        clearInterval(this.timer)
        this.timer = null
    }
}

export function registerCheckinRoutes(router, service, otherSites = []) {
    const wrap = (handler) => async (ctx) => {
        ctx.set('Cache-Control', 'no-store')
        const origin = ctx.get('Origin')
        if (ctx.method !== 'GET' && origin) {
            let host
            try {
                host = new URL(origin).hostname
            } catch {
                ctx.throw(403)
            }
            if (host !== ctx.hostname) {
                ctx.status = 403
                ctx.body = { error: '请从当前服务页面操作' }
                return
            }
        }
        try {
            ctx.body = await handler(ctx)
        } catch (error) {
            ctx.status = error.code === 'BUSY' ? 409 : error instanceof CheckinError ? 400 : 500
            ctx.body = { error: error instanceof CheckinError ? error.message : '签到配置读取或保存失败', code: error.code || 'INTERNAL' }
        }
    }
    router.get(
        '/api/checkin/sites',
        wrap(() => Promise.all([service, ...otherSites].map((item) => item.siteSummary())))
    )
    for (const item of [service, ...otherSites]) {
        const base = item === service ? '/api/checkin' : '/api/checkin/' + item.site.id
        router.get(base, wrap(() => item.state()))
        router.put(base + '/config', wrap((ctx) => item.saveConfig(ctx.request.body)))
        router.post(base + '/inspect', wrap(() => item.inspect()))
        router.post(base + '/run', wrap(() => item.run('manual')))
    }
}
