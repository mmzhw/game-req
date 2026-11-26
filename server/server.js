import fs from 'fs'
import path from 'path'
import https from 'https'
import http from 'http'
import Koa from 'koa'
import axios from 'axios'
import qs from 'qs'
import Router from 'koa-router'
import koaStatic from 'koa-static'
import { koaBody } from 'koa-body'
import { WebSocketServer } from 'ws'
import { CheckinService, registerCheckinRoutes } from './checkin/service.js'
import { FnatClient, FNAT_SITE, parseFnatCookie } from './checkin/fnat.js'
import { ItemsRepository, registerItemsRoutes } from './items.js'
import { GamesRepository, registerGameRoutes } from './games.js'
import { AdminAuth } from './admin/auth.js'
import { adminDatabaseFile, dataDir, openDatabase } from './admin/db.js'
import { isUpdateUpload, registerUpdateRoutes } from './update/routes.js'

console.log('process.env.NODE_ENV', process.env.NODE_ENV)
let isDev = process.env.NODE_ENV === 'dev'

/* 创建Koa应用实例 */
const app = new Koa({ proxy: process.env.GAME_REQ_TRUST_PROXY === '1' })
const router = new Router()
const checkinDir = process.env.CHECKIN_DATA_DIR || path.join(dataDir, 'checkin')
const auth = new AdminAuth(openDatabase(adminDatabaseFile))
auth.register(router)
const checkinService = await new CheckinService({ dataDir: checkinDir }).init()
const fnatService = await new CheckinService({
    dataDir: checkinDir,
    site: { id: 'fnat', name: 'FNAT 内网穿透', url: FNAT_SITE, requiresFingerprint: false, parseCookie: parseFnatCookie, supportsLottery: true, supportsPassword: true },
    clientFactory: (config) => new FnatClient(config)
}).init()
registerCheckinRoutes(router, checkinService, [fnatService])
const readBuildFile = (file) => JSON.parse(fs.readFileSync(new URL(file, import.meta.url), 'utf8'))
const build = process.env.GAME_REQ_MANAGED_RELEASE === '1' ? readBuildFile('./.release.json') : { id: 'local' }
registerUpdateRoutes(router, { root: process.cwd(), build })

const STATIC_DIST = path.resolve(process.env.GAME_REQ_STATIC_DIR || './dist')
const ITEMS_DIR = path.resolve(isDev ? './public/items' : path.join(STATIC_DIST, 'items'))
const TLS_DIR = process.env.GAME_REQ_TLS_DIR
const HTTPS_KEY = path.resolve(TLS_DIR || (isDev ? './server' : './dist'), './111.119.248.34.key')
const HTTPS_CER = path.resolve(TLS_DIR || (isDev ? './server' : './dist'), './111.119.248.34_cer.crt')
const HTTPS_CA = path.resolve(TLS_DIR || (isDev ? './server' : './dist'), './111.119.248.34_ca.crt')
const DEFAULT_SESSION_TTL_MS = 10 * 60 * 1000
const sessionCookieStore = new Map()

const gameDatabase = openDatabase(path.join(dataDir, 'items.db'))
const games = new GamesRepository(gameDatabase)
registerGameRoutes(router, games)
const items = new ItemsRepository(gameDatabase)
await items.seed(ITEMS_DIR)
registerItemsRoutes(router, items)

const parseBody = koaBody({ json: true, multipart: false, urlencoded: false })
const parseCatalog = koaBody({ jsonLimit: '8mb', multipart: false, urlencoded: false })
app.use(async (ctx, next) => {
    try {
        await next()
    } catch (error) {
        const status = error.status || 500
        if (status >= 500) ctx.app.emit('error', error, ctx)
        ctx.status = status
        ctx.body = { message: status < 500 ? error.message : '服务暂不可用' }
    }
})
    .use(auth.guard())
    .use((ctx, next) => {
        if (!['POST', 'PUT', 'PATCH'].includes(ctx.method) || isUpdateUpload(ctx)) return next()
        return (/^\/api\/items\/[^/]+\/import\//i.test(ctx.path) ? parseCatalog : parseBody)(ctx, next)
    })
    /* 指定一个目录作为静态资源的根目录（亦即站点根目录） */
    .use(koaStatic(STATIC_DIST))
    .use(router.routes())
    .use(router.allowedMethods())

const sleep = async (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

const normalizeHeaders = (headers) => {
    if (!headers) {
        return {}
    }
    if (typeof headers.toJSON === 'function') {
        return headers.toJSON()
    }
    return headers
}

const getRequestUrl = (config, nativeRequest) => {
    try {
        const host = nativeRequest?.getHeader?.('host') || normalizeHeaders(config?.headers)?.host
        if (nativeRequest?.protocol && nativeRequest?.path && host) {
            return `${nativeRequest.protocol}//${host}${nativeRequest.path}`
        }
    } catch (e) {}

    if (!config) {
        return ''
    }
    let url = `${config.baseURL || ''}${config.url || ''}`
    if (config.params) {
        const params = qs.stringify(config.params)
        if (params) {
            url += `${url.includes('?') ? '&' : '?'}${params}`
        }
    }
    return url
}

const formatResponseData = (data) => {
    if (data === undefined || data === null || data === '') {
        return '(空)'
    }
    if (typeof data === 'string') {
        const text = data.trim()
        if (!text) {
            return '(空)'
        }
        try {
            return JSON.stringify(JSON.parse(text), null, 2)
        } catch (e) {
            return text
        }
    }
    try {
        return JSON.stringify(data, null, 2)
    } catch (e) {
        return String(data)
    }
}

const formatRequestBody = (data) => {
    if (data === undefined || data === null || data === '') {
        return '(无)'
    }
    const text = Buffer.isBuffer(data) ? data.toString() : typeof data === 'string' ? data : JSON.stringify(data)
    try {
        return JSON.stringify(JSON.parse(text), null, 2)
    } catch (e) {}

    if (text.includes('=') || text.includes('&')) {
        try {
            const params = Array.from(new URLSearchParams(text).entries())
            if (params.length) {
                return params.map(([key, value]) => `  ${key}: ${value}`).join('\n')
            }
        } catch (e) {
            return text
        }
    }
    return text
}

const formatRequestLog = ({ body, option, result, error, durationMs, repeatIndex, repeatTotal }) => {
    const config = result?.config || error?.config || option
    const nativeRequest = result?.request || error?.request
    const response = result || error?.response
    const method = String(config?.method || option.method || '').toUpperCase()
    const repeatLabel = repeatIndex && repeatTotal ? `  第 ${repeatIndex}/${repeatTotal} 次` : ''
    const lines = [
        `${body.account || '-'}  ${body.name || '-'}${repeatLabel}  ${durationMs}ms`,
        '',
        '[请求]',
        `${method} ${getRequestUrl(config, nativeRequest)}`,
        '请求内容',
        formatRequestBody(config?.data),
        '',
        '[响应]'
    ]

    if (response) {
        lines.push(`HTTP ${response.status} ${response.statusText || ''}`.trim(), formatResponseData(response.data))
    } else {
        lines.push(`请求失败${error?.code ? ` (${error.code})` : ''}: ${error?.message || '未知错误'}`)
    }
    return lines.join('\n')
}

const sendLog = (message) => {
    for (const client of websocketServer.clients) {
        if (client.readyState !== 1) continue
        if (!auth.requestSession(client.request)) client.close(1008)
        else client.send(message, (error) => {
            if (error) console.error('[WEBSOCKET SERVER] send error:', error.message)
        })
    }
}

const getSessionKey = (session, account) => {
    return `${session.RESOLVE_URL}|${account}`
}

const getCookieHeader = (headers) => {
    const setCookie = headers?.['set-cookie']
    if (!setCookie) {
        return ''
    }
    const cookies = Array.isArray(setCookie) ? setCookie : [setCookie]
    return cookies
        .map((cookie) => String(cookie).split(';')[0])
        .filter(Boolean)
        .join('; ')
}

const resolveSessionCookie = async (body, session) => {
    const accountField = session.ACCOUNT_FIELD || 'account'
    const response = await axios({
        method: 'post',
        url: session.RESOLVE_URL,
        data: qs.stringify({ [accountField]: body.account }),
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            ...normalizeHeaders(body.headers)
        },
        timeout: Number(session.TIMEOUT_MS) || 15000,
        maxRedirects: 0,
        proxy: false
    })
    if (response.data?.ok === false) {
        throw new Error(`Session 绑定失败: ${response.data?.msg || '账号不存在或未创建角色'}`)
    }
    const cookie = getCookieHeader(response.headers)
    if (!cookie) {
        throw new Error('Session 绑定失败: 未返回 Cookie')
    }
    sessionCookieStore.set(getSessionKey(session, body.account), {
        cookie,
        expiresAt: Date.now() + (Number(session.TTL_MS) || DEFAULT_SESSION_TTL_MS)
    })
    return cookie
}

const getSessionCookie = async (body, forceResolve = false) => {
    const key = getSessionKey(body.session, body.account)
    if (forceResolve) {
        sessionCookieStore.delete(key)
    }
    const cached = sessionCookieStore.get(key)
    if (cached && cached.expiresAt > Date.now()) {
        return cached.cookie
    }
    return resolveSessionCookie(body, body.session)
}

const sendRequest = async (body, option, forceResolve = false) => {
    const headers = { ...normalizeHeaders(body.headers) }
    if (body.session) {
        headers.Cookie = await getSessionCookie(body, forceResolve)
    }
    option.headers = headers
    return axios(option)
}

const isSessionExpired = (data) => {
    if (!data || typeof data !== 'object') {
        return false
    }
    return Number(data.code) === 401 || /未登录|请先绑定|登录已失效/.test(String(data.msg || data.message || ''))
}

const sendWithSession = async (body, option) => {
    try {
        const result = await sendRequest(body, option)
        if (body.session && isSessionExpired(result.data)) {
            return sendRequest(body, option, true)
        }
        return result
    } catch (error) {
        if (body.session && error.response?.status === 401) {
            return sendRequest(body, option, true)
        }
        throw error
    }
}

const axiosContent = async (bodys = [], intervalMs, repeat = {}) => {
    for (let i = 0; i < bodys.length; i++) {
        let body = bodys[i]
        let option = {
            method: body.realReqMethod,
            url: body.realReqUrl,
            maxRedirects: 0,
            proxy: false,
            timeout: 15000,
            maxContentLength: 1024 * 1024
        }
        if (body.params) {
            option.params = body.params
        }
        if (body.data) {
            option.data = body.data
        }
        if (body.formData) {
            option.data = qs.stringify(body.formData)
        }
        const startedAt = Date.now()
        try {
            const result = await sendWithSession(body, option)
            sendLog(
                formatRequestLog({
                    body,
                    option,
                    result,
                    error: null,
                    durationMs: Date.now() - startedAt,
                    ...repeat
                })
            )
        } catch (error) {
            sendLog(
                formatRequestLog({
                    body,
                    option,
                    result: null,
                    error,
                    durationMs: Date.now() - startedAt,
                    ...repeat
                })
            )
        }
        if (intervalMs) {
            await sleep(intervalMs)
        }
    }
}

router
    .post('/api', async (ctx) => {
        const { reqData, repeatTime, intervalTime } = ctx.request.body || {}
        const repeatTotal = repeatTime === '' || repeatTime === undefined ? 1 : Number(repeatTime)
        const intervalMs = Number(intervalTime || 0) * 1000
        if (!Array.isArray(reqData) || !reqData.length || !Number.isSafeInteger(repeatTotal) || repeatTotal < 1 ||
            reqData.length * repeatTotal > 1000 || !Number.isFinite(intervalMs) || intervalMs < 0 || intervalMs > 60000)
            ctx.throw(400, '请求数据无效：任务最多 1000 次请求，间隔为 0–60 秒')
        const requests = reqData.map((body) => {
            const game = games.get(String(body?.game || ''))
            const allowedRequests = new Set(
                (game.config.operations || []).map((operation) => `${operation.method || 'POST'} ${operation.url}`)
            )
            const target = body?.realReqUrl
            const method = String(body?.realReqMethod || '').toUpperCase()
            if (!game.enabled || !allowedRequests.has(`${method} ${target}`) || typeof body.account !== 'string' ||
                body.account.length > 128 || !body.formData || typeof body.formData !== 'object' || Array.isArray(body.formData))
                ctx.throw(400, '发送请求不符合已配置的游戏平台')
            const operation = (game.config.operations || []).find((entry) => entry.url === target && (entry.method || 'POST') === method)
            const needsSession = !!operation?.session?.resolveUrl
            return {
                realReqUrl: target, realReqMethod: method, account: body.account, name: String(body.name || '').slice(0, 250),
                params: method === 'GET' ? body.formData : undefined,
                formData: method === 'POST' ? body.formData : undefined,
                headers: needsSession ? {
                    'X-Requested-With': 'XMLHttpRequest', Origin: new URL(target).origin, Referer: new URL('/gm.php', target).href
                } : undefined,
                session: needsSession ? { RESOLVE_URL: operation.session.resolveUrl, ACCOUNT_FIELD: 'account' } : undefined
            }
        })
        ctx.body = '正在处理，结果查看ws信息'
        if (repeatTime) {
            for (let i = 0; i < repeatTotal; i++) {
                await axiosContent(requests, intervalMs, {
                    repeatIndex: i + 1,
                    repeatTotal
                })
                if (intervalMs) {
                    await sleep(intervalMs)
                }
            }
        } else {
            await axiosContent(requests, intervalMs)
        }
    })

/* 创建挂载Koa应用程序的https服务 */
// 检查证书文件是否存在（开发环境强制使用HTTP）
const hasCertFiles = !isDev && fs.existsSync(HTTPS_KEY) && fs.existsSync(HTTPS_CER) && fs.existsSync(HTTPS_CA)
if (TLS_DIR && !hasCertFiles) throw new Error('GAME_REQ_TLS_DIR 未包含完整 HTTPS 证书')

let mainServer
if (hasCertFiles) {
    // 如果证书文件存在，则创建HTTPS服务器
    const options = {
        key: fs.readFileSync(HTTPS_KEY),
        cert: fs.readFileSync(HTTPS_CER),
        ca: fs.readFileSync(HTTPS_CA)
    }
    mainServer = https.createServer(options, app.callback())
    console.log('Using HTTPS server')
} else {
    // 如果证书文件不存在或开发环境，则使用HTTP服务器
    mainServer = http.createServer(app.callback())
    console.log('Using HTTP server' + (isDev ? ' (development mode)' : ' (certificates not found)'))
}

const websocketServer = new WebSocketServer({ noServer: true, maxPayload: 1024 })
mainServer.on('upgrade', (request, socket, head) => {
    let sameOrigin = false
    try {
        sameOrigin = new URL(request.headers.origin).host === request.headers.host
    } catch {
        sameOrigin = false
    }
    if (request.url !== '/ws' || !sameOrigin || !auth.requestSession(request)) {
        socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n')
        return
    }
    websocketServer.handleUpgrade(request, socket, head, (ws) => {
        ws.request = request
        websocketServer.emit('connection', ws)
    })
})
websocketServer.on('connection', (ws) => {
    ws.on('message', (message) => {
        if (!auth.requestSession(ws.request)) ws.close(1008)
        else if (String(message) === 'ping') ws.send('pong')
    })
    ws.on('error', () => {
        console.log('[WEBSOCKET SERVER] disconnect error')
    })
})

/* 开始监听/启动服务（指定3000端口与成功回调） */
mainServer.listen(Number(process.env.GAME_REQ_PORT || 3000), process.env.GAME_REQ_HOST, () => {
    checkinService.start()
    fnatService.start()
    let port = mainServer.address().port
    if (hasCertFiles) {
        console.log('应用实例，访问地址为 https://localhost:' + port)
    } else {
        console.log('应用实例，访问地址为 http://localhost:' + port)
    }
})
