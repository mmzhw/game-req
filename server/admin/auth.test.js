import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { WebSocket } from 'ws'

const root = fileURLToPath(new URL('../../', import.meta.url))
const username = 'test-admin'
const password = '1'

async function startBackend(context) {
    const data = await fs.mkdtemp(path.join(os.tmpdir(), 'game-req-admin-'))
    const env = { ...process.env, NODE_ENV: 'dev', GAME_REQ_PORT: '0', GAME_REQ_HOST: '127.0.0.1', GAME_REQ_DATA_DIR: data, CHECKIN_DATA_DIR: path.join(data, 'checkin'), GAME_REQ_TLS_DIR: '', GAME_REQ_TRUST_PROXY: '', GAME_REQ_MANAGED_RELEASE: '' }
    let child
    const stop = async () => {
        if (!child || child.exitCode !== null || child.signalCode !== null) return
        const exit = once(child, 'exit')
        child.kill()
        await exit
    }
    context.after(async () => {
        await stop()
        await fs.rm(data, { recursive: true, force: true })
    })
    const start = async () => {
        child = spawn(process.execPath, ['server/server.js'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] })
        let logs = ''
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timed out waiting for test backend')), 10000)
            child.once('error', (error) => {
                clearTimeout(timeout)
                reject(error)
            })
            child.once('exit', (code) => {
                clearTimeout(timeout)
                reject(new Error(`Backend exited with ${code}: ${logs}`))
            })
            child.stderr.setEncoding('utf8').on('data', (chunk) => { logs += chunk })
            child.stdout.setEncoding('utf8').on('data', (chunk) => {
                logs += chunk
                const port = logs.match(/http:\/\/localhost:(\d+)\r?\n/)?.[1]
                if (!port) return
                clearTimeout(timeout)
                resolve(`http://127.0.0.1:${port}`)
            })
        })
    }
    const reset = (nextPassword) => spawnSync(process.execPath, ['server/admin/reset-password.js'], { cwd: root, env, input: nextPassword + '\n', encoding: 'utf8', timeout: 5000 })
    return { start, stop, reset }
}

function request(base, route, { body, cookie, csrf = true, crossSite = false, method = body === undefined ? 'GET' : 'POST' } = {}) {
    const headers = new Headers()
    if (body !== undefined) headers.set('Content-Type', 'application/json')
    if (cookie) headers.set('Cookie', cookie)
    if (method === 'POST' && csrf) headers.set('X-Game-Req', '1')
    if (crossSite) headers.set('Sec-Fetch-Site', 'cross-site')
    return fetch(base + route, { method, headers, body: JSON.stringify(body), signal: AbortSignal.timeout(5000) })
}

test('first setup, authorization, persistent login, password reset and logout through the real backend', { timeout: 30000 }, async (context) => {
    const backend = await startBackend(context)
    let base = await backend.start()
    assert.deepEqual(await (await request(base, '/api/auth/status')).json(), { setupRequired: true, username: null })
    assert.equal((await request(base, '/api/items/catalogs')).status, 401)
    assert.equal((await request(base, '/api/checkin/sites')).status, 401)
    assert.equal((await request(base, '/assets/%67ame-options-fixture.js')).status, 401)
    assert.equal((await request(base, '/uploadServer', { body: {} })).status, 401)
    const credentials = { username, password }
    assert.equal((await request(base, '/api/auth/setup', { body: credentials, csrf: false })).status, 403)
    assert.equal((await request(base, '/api/auth/setup', { body: credentials, crossSite: true })).status, 403)
    assert.equal((await request(base, '/api/auth/setup', { body: { ...credentials, password: '' } })).status, 400)
    const attempts = await Promise.all([request(base, '/api/auth/setup', { body: credentials }), request(base, '/api/auth/setup', { body: credentials })])
    assert.deepEqual(attempts.map((response) => response.status).sort(), [201, 409])
    const setCookie = attempts.find((response) => response.status === 201).headers.get('set-cookie')
    assert.match(setCookie, /httponly/i)
    assert.match(setCookie, /samesite=strict/i)
    let cookie = setCookie.split(';')[0]
    assert.deepEqual(await (await request(base, '/api/auth/status', { cookie })).json(), { setupRequired: false, username })
    assert.equal((await request(base, '/api/auth/setup', { body: credentials })).status, 409)
    assert.equal((await request(base, '/restart', { body: {}, cookie, csrf: false })).status, 403)
    assert.equal((await request(base, '/api/update/status', { cookie })).status, 200)
    const socketUrl = base.replace('http:', 'ws:') + '/ws'
    const rejected = new WebSocket(socketUrl, { origin: 'http://foreign.invalid', headers: { Cookie: cookie } })
    await assert.rejects(once(rejected, 'open'), /403/)
    const connected = new WebSocket(socketUrl, { origin: base, headers: { Cookie: cookie } })
    await once(connected, 'open')
    const message = once(connected, 'message')
    connected.send('ping')
    assert.equal(String((await message)[0]), 'pong')
    connected.close()
    await once(connected, 'close')

    const catalogs = await (await request(base, '/api/items/catalogs', { cookie })).json()
    assert.equal(catalogs.length, 6)
    const gameUrl = `/api/items/${catalogs[0].game}`
    const sample = [{ value: '1', name: '示例物品', action: 'mail' }]
    const text = JSON.stringify(sample)
    const preview = await (await request(base, gameUrl + '/import/preview', { cookie, body: { text } })).json()
    assert.equal(preview.count, 1)
    const confirm = { sha256: preview.sha256, source: 'sample.txt', text }
    assert.equal((await request(base, gameUrl + '/import/confirm', { cookie, body: { ...confirm, text: '[]' } })).status, 400)
    assert.equal((await request(base, gameUrl + '/import/confirm', { cookie, body: { ...confirm, text: `${text} ` } })).status, 409)
    const imported = await request(base, gameUrl + '/import/confirm', { cookie, body: confirm })
    assert.equal(imported.status, 200)
    assert.equal((await request(base, gameUrl + '/import/confirm', { cookie, body: confirm })).status, 200)

    await backend.stop()
    base = await backend.start()
    assert.deepEqual(await (await request(base, '/api/auth/status', { cookie })).json(), { setupRequired: false, username })
    assert.deepEqual((await (await request(base, gameUrl, { cookie })).json()).list.map(({ _position, ...item }) => item), sample)
    assert.equal((await (await request(base, '/api/items/catalogs', { cookie })).json())[0].source, 'sample.txt')

    assert.equal(backend.reset('').status, 1)
    const nextPassword = 'n'.repeat(129)
    const reset = backend.reset(nextPassword)
    assert.equal(reset.status, 0, reset.stderr)
    assert.equal((await request(base, '/api/items/catalogs', { cookie })).status, 401)
    assert.equal((await request(base, '/api/auth/login', { body: { username, password } })).status, 401)
    const login = await request(base, '/api/auth/login', { body: { username, password: nextPassword } })
    assert.equal(login.status, 200)
    cookie = login.headers.get('set-cookie').split(';')[0]
    assert.equal((await request(base, '/api/auth/logout', { body: {}, cookie })).status, 204)
    assert.equal((await request(base, '/api/items/catalogs', { cookie })).status, 401)
})
