import { createServer, get as getHttp } from 'node:http'
import { get as getHttps } from 'node:https'
import { execFile } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { setTimeout as wait } from 'node:timers/promises'
import { promisify } from 'node:util'
import { exists, isAuthorized, jobPath, readJson, supervisorToken, validJobId, writeJson } from './common.js'

const root = process.cwd()
const updates = path.join(root, '.updates')
const journal = path.join(updates, 'active.json')
const run = promisify(execFile)
const restart = () => run('pm2', ['restart', 'server'], { cwd: root, timeout: 20000 })
let busy = false

function health() {
    const tls = !!process.env.GAME_REQ_TLS_DIR
    const get = tls ? getHttps : getHttp
    return new Promise((resolve, reject) => {
        const request = get(`${tls ? 'https' : 'http'}://127.0.0.1:3000/api/update/health`, { rejectUnauthorized: false, timeout: 800 }, (response) => {
            let body = ''
            response.setEncoding('utf8')
            response.on('data', (chunk) => {
                body += chunk
                if (body.length > 4096) request.destroy(new Error('健康检查响应过大'))
            })
            response.on('end', () => {
                try {
                    resolve(response.statusCode === 200 ? JSON.parse(body) : null)
                } catch {
                    resolve(null)
                }
            })
            response.on('error', reject)
        })
        request.on('timeout', () => request.destroy(new Error('健康检查超时')))
        request.on('error', reject)
    })
}

async function waitForHealth(expected) {
    for (let attempt = 0; attempt < 36; attempt++) {
        const state = await health().catch(() => null)
        if (state?.id && (!expected || expected === state.id)) return
        await wait(500)
    }
    throw new Error('服务未通过健康检查')
}

const targets = (kind) => (kind === 'server' ? ['dist', 'runtime'] : ['dist'])
const readJob = (id) => readJson(path.join(jobPath(root, id), 'status.json'))
const saveJob = (state, phase, message) => writeJson(path.join(jobPath(root, state.id), 'status.json'), { ...state, phase, message })

async function swap(directory, name) {
    const live = path.join(root, name)
    await fs.rename(live, path.join(directory, 'previous', name))
    await fs.rename(path.join(directory, 'next', name), live)
}

async function rollback(directory, state) {
    for (const name of targets(state.kind).reverse()) {
        const backup = path.join(directory, 'previous', name)
        if (!(await exists(backup))) continue
        const live = path.join(root, name)
        if (await exists(live)) await fs.rename(live, path.join(directory, 'rejected-' + name))
        await fs.rename(backup, live)
    }
    if (state.kind === 'server') {
        await restart()
        await waitForHealth(await liveId())
    }
}

async function liveId() {
    return (await readJson(path.join(root, 'runtime', '.release.json'))).id
}

async function restore(directory, state) {
    try {
        await rollback(directory, state)
        await saveJob(state, 'failed', '更新失败，已恢复原版本')
        return true
    } catch {
        await saveJob(state, 'rollback_failed', '自动回退未完成，请查看容器日志；已保留备份')
        console.error('[UPDATE] rollback failed:', state.id)
        return false
    }
}

async function cleanup(directory) {
    for (const name of ['next', 'previous', 'rejected-runtime', 'rejected-dist']) await fs.rm(path.join(directory, name), { recursive: true, force: true })
}

async function update(state) {
    const directory = jobPath(root, state.id)
    let switching = false,
        canClean = true,
        failure = '无法准备更新，原服务未切换'
    try {
        if (state.kind === 'server') {
            failure = '生产依赖安装失败，原服务未切换；请检查容器网络和依赖锁文件'
            await saveJob(state, 'installing', '正在当前容器安装生产依赖')
            const runtime = path.join(directory, 'next', 'runtime')
            await run('pnpm', ['install', '--prod', '--frozen-lockfile', '--ignore-scripts', '--prefer-offline'], { cwd: runtime, timeout: 300000, maxBuffer: 1024 * 1024 })
            failure = '新版服务入口语法检查失败，原服务未切换'
            await run(process.execPath, ['--check', 'server.js'], { cwd: runtime, timeout: 5000 })
        }
        await fs.mkdir(path.join(directory, 'previous'), { mode: 0o700 })
        await saveJob(state, 'switching', state.kind === 'server' ? '正在切换代码并验证新版服务' : '正在切换前端资源')
        switching = true
        for (const name of targets(state.kind)) await swap(directory, name)
        if (state.kind === 'server') {
            await restart()
            await waitForHealth(state.id)
        }
        await saveJob(state, 'success', state.kind === 'server' ? '服务端已更新，新版本健康检查通过' : '前端已更新，刷新页面后生效')
    } catch (error) {
        console.error('[UPDATE] apply failed:', state.id, state.kind, switching ? 'switching' : 'preparing', error.code || error.name)
        if (switching) canClean = await restore(directory, state)
        else await saveJob(state, 'failed', failure)
    } finally {
        if (canClean) {
            await cleanup(directory).catch(() => {})
            await fs.unlink(journal).catch(() => {})
        }
        busy = false
    }
}

await fs.mkdir(updates, { recursive: true, mode: 0o700 })
if (await exists(journal)) {
    const { id } = await readJson(journal)
    const directory = jobPath(root, id)
    const state = await readJob(id)
    const recovered = state.phase !== 'switching' || (await restore(directory, state))
    if (['queued', 'installing'].includes(state.phase)) await saveJob(state, 'failed', '更新中断，未修改运行文件')
    if (recovered && state.phase !== 'rollback_failed') {
        await cleanup(directory).catch(() => {})
        await fs.unlink(journal)
    }
}

const server = createServer(async (request, response) => {
    const send = (status, message) => {
        response.writeHead(status, { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': 'no-store' })
        response.end(JSON.stringify({ message }))
    }
    if (request.method !== 'POST' || !['/apply', '/restart'].includes(request.url)) return send(404, '没有找到操作')
    if (!isAuthorized(request.headers.authorization, supervisorToken())) return send(401, '无权执行此操作')
    if (busy) return send(409, '已有更新或重启正在执行')
    busy = true
    try {
        if (await exists(journal)) return send(409, '上一次更新尚未恢复，请查看容器日志')
        let body = ''
        for await (const chunk of request) {
            body += chunk
            if (body.length > 4096) return send(413, '请求过大')
        }
        if (request.url === '/restart') {
            send(202, '已提交重启')
            setTimeout(() => restart().catch(() => console.error('[UPDATE] manual restart failed')).finally(() => (busy = false)), 600)
            return
        }
        const { id } = JSON.parse(body)
        if (!validJobId(id)) return send(400, '无效的更新编号')
        const state = await readJob(id)
        if (state.id !== id || state.phase !== 'queued' || !['server', 'frontend'].includes(state.kind)) return send(409, '更新状态无效')
        await writeJson(journal, { id })
        send(202, '已提交更新')
        setTimeout(() => update(state).catch(() => console.error('[UPDATE] unexpected failure:', id)), 600)
    } catch {
        send(500, '无法提交更新')
    } finally {
        if (response.statusCode !== 202) busy = false
    }
})

server.listen(3001, '127.0.0.1', () => console.log('[UPDATE] supervisor ready'))
