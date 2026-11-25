import test from 'node:test'
import assert from 'node:assert/strict'
import { FnatClient, parseFnatCookie, parseFnatPage } from './fnat.js'

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
