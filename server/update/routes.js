import fs from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { koaBody } from 'koa-body'
import { stageBundle } from './bundle.js'
import { jobPath, managed, MAX_ZIP_BYTES, readJson, supervisorToken, tokenConfigured, updateAuthorization, validJobId, writeJson } from './common.js'

const uploadKinds = new Map([['/upload', 'frontend'], ['/uploadServer', 'server']])
const STATUS = '/api/update/jobs/'
const canUpdate = () => managed() && tokenConfigured(supervisorToken())
export const isUpdateUpload = (ctx) => ctx.method === 'POST' && /^\/(?:upload|uploadServer)\/?$/i.test(ctx.path)

async function ensureManaged(ctx, next) {
    ctx.set('Cache-Control', 'no-store')
    if (!canUpdate()) ctx.throw(503, '页面更新仅在具有更新进程的 Docker 部署中可用')
    await next()
}

async function supervisor(route, id) {
    const secret = supervisorToken()
    const send = (authorization) => fetch('http://127.0.0.1:3001' + route, {
        method: 'POST',
        headers: { Authorization: authorization, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
        signal: AbortSignal.timeout(3000)
    }).catch(() => null)
    let response = await send(updateAuthorization(secret))
    // Older images still run the Bearer-only supervisor after a web update.
    if (response?.status === 401 && /^[!-~](?:[ -~]*[!-~])?$/.test(secret)) response = await send('Bearer ' + secret)
    if (response?.ok) return
    const body = await response?.json().catch(() => null)
    const error = new Error(body?.message || '更新管理进程未响应')
    error.status = response?.status || 503
    throw error
}

export function registerUpdateRoutes(router, { root, build }) {
    let staging = false
    router.get('/api/update/health', (ctx) => {
        ctx.set('Cache-Control', 'no-store')
        ctx.body = build
    })
    router.get('/api/update/status', (ctx) => {
        ctx.set('Cache-Control', 'no-store')
        ctx.body = { enabled: canUpdate(), version: build.version }
    })
    router.get(STATUS + ':id', ensureManaged, async (ctx) => {
        if (!validJobId(ctx.params.id)) ctx.throw(404)
        try {
            ctx.body = await readJson(path.join(jobPath(root, ctx.params.id), 'status.json'))
        } catch (error) {
            if (error.code === 'ENOENT') ctx.throw(404, '没有找到这次更新')
            throw error
        }
    })
    router.post('/restart', ensureManaged, async (ctx) => {
        try {
            await supervisor('/restart')
            ctx.status = 202
            ctx.body = { message: '已提交重启，服务恢复后可刷新页面' }
        } catch (error) {
            ctx.throw(error.status, error.message)
        }
    })
    for (const [route, kind] of uploadKinds) {
        router.post(route, ensureManaged, async (ctx) => {
            if (staging) ctx.throw(409, '已有更新包正在处理，请稍后再试')
            staging = true
            const id = randomUUID().replaceAll('-', '')
            const directory = jobPath(root, id)
            let queued = false
            try {
                await fs.mkdir(directory, { recursive: true, mode: 0o700 })
                await koaBody({ multipart: true, formidable: { uploadDir: directory, maxFiles: 1, maxFileSize: MAX_ZIP_BYTES, maxTotalFileSize: MAX_ZIP_BYTES, maxFields: 1 } })(ctx, async () => {})
                const uploaded = ctx.request.files?.file
                const file = Array.isArray(uploaded) ? uploaded[0] : uploaded
                if (!file?.originalFilename?.toLowerCase().endsWith('.zip')) ctx.throw(400, '请选择对应的 ZIP 更新包')
                const manifest = await stageBundle(file.filepath, directory, kind, id)
                await fs.unlink(file.filepath)
                const state = { id, ...manifest, phase: 'queued', message: '更新包已校验，等待应用' }
                await writeJson(path.join(directory, 'status.json'), state)
                await supervisor('/apply', id)
                queued = true
                ctx.status = 202
                ctx.body = state
            } catch (error) {
                ctx.status = error.status || error.httpCode || 400
                ctx.body = { message: error.expose === false ? '无法处理更新包' : error.message }
            } finally {
                staging = false
                if (!queued) {
                    const state = await readJson(path.join(directory, 'status.json')).catch(() => null)
                    if (!state) await fs.rm(directory, { recursive: true, force: true }).catch(() => {})
                }
            }
        })
    }
}
