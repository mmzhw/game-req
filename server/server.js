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
import cors from 'koa2-cors'
import { WebSocketServer } from 'ws'
import { CheckinService, registerCheckinRoutes } from './checkin/service.js'
import { FnatClient, FNAT_SITE, parseFnatCookie } from './checkin/fnat.js'
import { isUpdateUpload, registerUpdateRoutes } from './update/routes.js'

let singleWs = null
console.log('process.env.NODE_ENV', process.env.NODE_ENV)
let isDev = process.env.NODE_ENV === 'dev'

/* 创建Koa应用实例 */
const app = new Koa()
const router = new Router()
const checkinService = await new CheckinService().init()
const fnatService = await new CheckinService({
    site: { id: 'fnat', name: 'FNAT 内网穿透', url: FNAT_SITE, requiresFingerprint: false, parseCookie: parseFnatCookie },
    clientFactory: (config) => new FnatClient(config)
}).init()
registerCheckinRoutes(router, checkinService, [fnatService])
const readBuildFile = (file) => JSON.parse(fs.readFileSync(new URL(file, import.meta.url), 'utf8'))
const build = process.env.GAME_REQ_MANAGED_RELEASE === '1' ? readBuildFile('./.release.json') : { id: 'local' }
registerUpdateRoutes(router, { root: process.cwd(), build })

const UPLOAD_DIR = path.resolve(isDev ? './server' : './', './uploads')
const STATIC_DIST = path.resolve('./', './dist')
const TLS_DIR = process.env.GAME_REQ_TLS_DIR
const HTTPS_KEY = path.resolve(TLS_DIR || (isDev ? './server' : './dist'), './111.119.248.34.key')
const HTTPS_CER = path.resolve(TLS_DIR || (isDev ? './server' : './dist'), './111.119.248.34_cer.crt')
const HTTPS_CA = path.resolve(TLS_DIR || (isDev ? './server' : './dist'), './111.119.248.34_ca.crt')
const DEFAULT_SESSION_TTL_MS = 10 * 60 * 1000
const sessionCookieStore = new Map()

const parseBody = koaBody({ multipart: true, formidable: { uploadDir: UPLOAD_DIR, keepExtensions: true } })
app.use(cors())
    .use((ctx, next) => (isUpdateUpload(ctx) ? next() : parseBody(ctx, next)))
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

const formatRequestLog = ({ body, option, result, error, durationMs }) => {
    const config = result?.config || error?.config || option
    const nativeRequest = result?.request || error?.request
    const response = result || error?.response
    const method = String(config?.method || option.method || '').toUpperCase()
    const lines = [`${body.account || '-'}  ${body.name || '-'}  ${durationMs}ms`, '', '[请求]', `${method} ${getRequestUrl(config, nativeRequest)}`, '请求内容', formatRequestBody(config?.data), '', '[响应]']

    if (response) {
        lines.push(`HTTP ${response.status} ${response.statusText || ''}`.trim(), formatResponseData(response.data))
    } else {
        lines.push(`请求失败${error?.code ? ` (${error.code})` : ''}: ${error?.message || '未知错误'}`)
    }
    return lines.join('\n')
}

const sendLog = (message) => {
    if (!singleWs || singleWs.readyState !== 1) {
        return
    }
    try {
        singleWs.send(message, (error) => {
            if (error) {
                console.error('[WEBSOCKET SERVER] send error:', error.message)
            }
        })
    } catch (e) {
        console.error('[WEBSOCKET SERVER] send error:', e.message)
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
        timeout: Number(session.TIMEOUT_MS) || 15000
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

const axiosContent = async (bodys = [], intervalTime) => {
    for (let i = 0; i < bodys.length; i++) {
        let body = bodys[i]
        let option = {
            method: body.realReqMethod,
            url: body.realReqUrl
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
                    durationMs: Date.now() - startedAt
                })
            )
        } catch (error) {
            sendLog(
                formatRequestLog({
                    body,
                    option,
                    result: null,
                    error,
                    durationMs: Date.now() - startedAt
                })
            )
        }
        if (intervalTime) {
            await sleep(Number(intervalTime))
        }
    }
}

router
    .post('/api', async (ctx) => {
        if (!ctx.request.body?.reqData || !ctx.request.body?.reqData?.length) {
            ctx.body = '数据异常'
            return
        }
        ctx.body = '正在处理，结果查看ws信息'
        let intervalTime = ctx.request.body.intervalTime
        let repeatTime = ctx.request.body.repeatTime
        if (repeatTime) {
            for (let i = 0; i < Number(repeatTime); i++) {
                await axiosContent(ctx.request.body.reqData, intervalTime)
                if (intervalTime) {
                    await sleep(Number(intervalTime))
                }
            }
        } else {
            await axiosContent(ctx.request.body.reqData, intervalTime)
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

const websocketServer = new WebSocketServer({ server: mainServer })
websocketServer.on('connection', (ws) => {
    console.log('[WEBSOCKET SERVER] connection()')
    singleWs = ws
    singleWs.on('message', (message) => {
        const result = String(message)
        console.log(`[WEBSOCKET SERVER] Received: ${result}`)
        if (result === 'ping') {
            singleWs && singleWs.send('pong')
        }
    })
    singleWs.on('error', (error) => {
        console.log('[WEBSOCKET SERVER] disconnect error')
    })
    singleWs.on('close', (error) => {
        console.log('[WEBSOCKET SERVER] disconnect close')
    })
})

/* 开始监听/启动服务（指定3000端口与成功回调） */
mainServer.listen(3000, () => {
    checkinService.start()
    fnatService.start()
    let port = mainServer.address().port
    if (hasCertFiles) {
        console.log('应用实例，访问地址为 https://localhost:' + port)
    } else {
        console.log('应用实例，访问地址为 http://localhost:' + port)
    }
})
