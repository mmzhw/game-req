import test from 'node:test'
import assert from 'node:assert/strict'
import { FnatClient, FNAT_SITE, parseFnatCookie, parseFnatPage } from './fnat.js'

const config = { cookie: 'PHPSESSID=test-session', account: 'example' }
const page = '<p class="user-name mb-0">example</p><h6>您今天还没有签到哦</h6><p>总计已签到 86 天</p><script>const csrf_token = "abc123def456";</script>'

test('FNAT uses only the session cookie and checks the active account', () => {
    assert.deepEqual([...parseFnatCookie('analytics=test; PHPSESSID=test-session')], [['PHPSESSID', 'test-session']])
    assert.throws(() => parseFnatCookie('PHPSESSID=one; PHPSESSID=two'), { code: 'COOKIE_INVALID' })
    assert.throws(() => parseFnatPage(page, 'another'), { code: 'ACCOUNT_MISMATCH' })
    assert.equal(parseFnatPage(page, config.account).counters.lxtdays, 86)
})

test('FNAT prepares a fresh CSRF value and reserves one write before submitting', async () => {
    const paths = []
    const client = new FnatClient(config, {
        async get(url, options) {
            paths.push(new URL(url).pathname)
            assert.equal(options.maxRedirects, 0)
            if (paths.length === 3) assert.equal(options.params.csrf, 'abc123def456')
            return { status: 200, data: paths.length === 3 ? { code: 200 } : page }
        }
    })
    const result = await client.execute({ beforePost: async () => paths.push('reserved') })
    assert.deepEqual(paths, ['/console/Sign', 'reserved', '/console/Signc/Sign'])
    assert.equal(result.status, 'success')
})

test('FNAT does not submit after an expired session or a recognized signed page', async () => {
    const expired = new FnatClient(config, { get: async () => ({ status: 302, headers: { location: '/auth/login/' } }) })
    const beforePost = async () => assert.fail('must not reserve a submission')
    await assert.rejects(() => expired.execute({ beforePost }), { code: 'SESSION_EXPIRED' })
    const signed = new FnatClient(config, { get: async () => ({ status: 200, data: page.replace('您今天还没有签到哦', '您今天已经签到') }) })
    assert.equal((await signed.execute({ beforePost })).status, 'skipped')
})

test('FNAT password mode solves GeeTest only after the saved session expires', async () => {
    const calls = []
    const passwordConfig = { account: 'example', authMode: 'password', password: 'private-password', allowInsecureLogin: true, cookie: '' }
    const transport = {
        async get(url, options) {
            calls.push({ method: 'GET', url, cookie: options.headers.Cookie || '' })
            if (url === FNAT_SITE + '/console/Sign' && calls.filter((item) => item.url === url).length === 1) {
                return { status: 302, headers: { location: '/auth/login/' } }
            }
            if (url === 'https://frp.fnat.cc/auth/login') {
                return { status: 301, headers: { location: 'http://frp.fnat.cc/auth/login/' } }
            }
            if (url === 'http://frp.fnat.cc/auth/login/') {
                return { status: 200, headers: { 'set-cookie': ['PHPSESSID=anonymous-session; path=/'] }, data: '<form id="loginForm"></form><script>var geetestData={gt: "09abc63504b453c349cacd7169b9fc6b"}</script>' }
            }
            return { status: 200, headers: {}, data: page }
        },
        async post(url, body, options) {
            calls.push({ method: 'POST', url, body, cookie: options.headers.Cookie || '' })
            return { status: 302, headers: { location: './?status=200', 'set-cookie': ['PHPSESSID=logged-in-session; path=/'] } }
        }
    }
    let solves = 0
    const client = new FnatClient(passwordConfig, transport, async (captchaId) => {
        solves++
        assert.equal(captchaId, '09abc63504b453c349cacd7169b9fc6b')
        return { captcha_id: captchaId, lot_number: 'lot-number', pass_token: 'pass-token' }
    })
    const inspected = await client.inspect()
    assert.equal(inspected.account, 'example')
    assert.equal(solves, 1)
    assert.equal(client.cookieHeader(), 'PHPSESSID=logged-in-session')
    const login = calls.find((item) => item.method === 'POST')
    const fields = new URLSearchParams(login.body)
    assert.equal(fields.get('username'), 'example')
    assert.equal(fields.get('password'), 'private-password')
    assert.equal(fields.get('geetest_validate'), 'lot-number')
    assert.equal(login.cookie, 'PHPSESSID=anonymous-session')
    assert.equal(calls.at(-1).cookie, 'PHPSESSID=logged-in-session')
})

const free = { id: '1', cost_type: 'free', cost_amount: '0.00', daily_limit: '1', user_daily_count: 0, can_draw: true, prizes: [{}] }
const paid = { ...free, id: '2', cost_type: 'balance', cost_amount: '10.00' }
function lotteryClient(configs, post, html = page) {
    return new FnatClient(config, {
        async get(url, options) {
            if (new URL(url).pathname === '/console/Lottery') return { status: 200, data: html }
            assert.equal(new URL(url).pathname, '/api/lottery.php')
            assert.deepEqual(options.params, { action: 'get_lottery_info' })
            return { status: 200, data: { success: true, data: { configs } } }
        },
        post
    })
}

test('FNAT submits the verified free wheel exactly once, after reserving', async () => {
    let reserved = false
    let posts = 0
    const client = lotteryClient([paid, free], async (url, body, options) => {
        assert.equal(reserved, true)
        posts++
        assert.equal(new URL(url).pathname, '/api/lottery.php')
        assert.deepEqual([...body], [['action', 'draw'], ['lottery_id', '1']])
        assert.equal(options.maxRedirects, 0)
        return { status: 200, data: { success: true, data: { prize: { name: '10 金币' }, private: 'do-not-record' } } }
    })
    assert.match((await client.draw({ beforePost: async () => { reserved = true } })).message, /10 金币/)
    assert.equal(posts, 1)
    assert.doesNotMatch(JSON.stringify(client.submissionTrace), /do-not-record|test-session/)
})

test('FNAT never reserves exhausted, paid-only, ambiguous, or unauthorized draws', async () => {
    const never = () => assert.fail('must not reserve or submit')
    const hooks = { beforePost: never }
    assert.equal((await lotteryClient([{ ...free, user_daily_count: 1 }, paid], never).draw(hooks)).status, 'skipped')
    for (const configs of [[paid], [free, { ...paid, id: '1' }], [{ ...free, cost_amount: '0.10' }], [{ ...free, daily_limit: 0 }]]) {
        await assert.rejects(() => lotteryClient(configs, never).draw(hooks), { code: 'LOTTERY_UNKNOWN' })
    }
    await assert.rejects(() => lotteryClient([free], never, page.replace('>example<', '>other<')).draw(hooks), { code: 'ACCOUNT_MISMATCH' })
    await assert.rejects(() => lotteryClient([free], never, '<form id="loginForm">').draw(hooks), { code: 'SESSION_EXPIRED' })
})
