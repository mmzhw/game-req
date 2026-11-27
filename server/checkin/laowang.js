import { Buffer } from 'node:buffer'
import axios from 'axios'
import sharp from 'sharp'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { createHash } from 'node:crypto'
import { setTimeout as delay } from 'node:timers/promises'

export const SITE = 'https://laowang.vip'
export const SIGN_PAGE = '/plugin.php?id=k_misign:sign'
export const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36'
const CLIENT_SHA256 = '19baac0b0278e26974d91f70a16ddd99a32aab1ff0af83a83f8fdb0a254768f2'

export class CheckinError extends Error {
    constructor(code, message) {
        super(message)
        this.code = code
    }
}

export function parseCookieHeader(header) {
    if (typeof header !== 'string' || header.length > 32000 || /[\r\n]/.test(header)) throw new CheckinError('COOKIE_INVALID', 'Cookie 格式不正确')
    const cookies = new Map()
    for (const pair of header.split(';')) {
        const index = pair.indexOf('=')
        if (index < 1) continue
        const name = pair.slice(0, index).trim(),
            value = pair.slice(index + 1).trim()
        if (!/^[A-Za-z0-9_]+$/.test(name) || /[^\x20-\x7e]/.test(value)) throw new CheckinError('COOKIE_INVALID', 'Cookie 包含无效字符')
        cookies.set(name, value)
    }
    if (!cookies.get('X9wU_2132_auth') || !cookies.get('X9wU_2132_saltkey')) throw new CheckinError('COOKIE_INVALID', '请获取老王论坛的完整 Cookie，需包含 auth 和 saltkey')
    return cookies
}

function decodeAttribute(value) {
    return value
        .replace(/&amp;/g, '&')
        .replace(/&#39;/g, String.fromCharCode(39))
        .replace(/&quot;/g, '"')
}
function checkedAction(value) {
    const url = new URL(decodeAttribute(value), SITE)
    if (url.origin !== SITE || url.pathname !== '/plugin.php' || url.searchParams.get('id') !== 'k_misign:sign' || url.searchParams.get('operation') !== 'qiandao' || !/^[a-z0-9]{4,64}$/i.test(url.searchParams.get('formhash') || '')) throw new CheckinError('PAGE_CHANGED', '签到地址发生变化，已停止提交')
    return url.href
}

function traceUrl(value) {
    const url = new URL(value, SITE)
    if (url.origin !== SITE || !['/', '/plugin.php', '/sign.php', '/member.php'].includes(url.pathname)) return '[已隐藏]'
    const query = [...url.searchParams].map(([name, value]) => {
        if ((name === 'id' && value === 'k_misign:sign') || (name === 'operation' && value === 'qiandao')) return name + '=' + value
        return (['id', 'operation', 'formhash', 'format', 'inajax', 'ajaxtarget'].includes(name) ? name : '参数') + '=[已隐藏]'
    })
    return url.origin + url.pathname + (query.length ? '?' + query.join('&') : '')
}

function traceLocation(value) {
    if (!value) return null
    try {
        return traceUrl(value)
    } catch {
        return '[已隐藏]'
    }
}

const TRACE_BODY_LIMIT = 2048
function traceBody(body, contentType, secrets) {
    const bytes = body.length
    if (!bytes) return { bytes, kind: 'empty' }
    if (contentType !== 'text/plain' || bytes > 8192) return { bytes, kind: 'omitted' }
    let text = body.toString('utf8')
    if (/[<>]|\uFFFD/.test(text) || [...text].some((char) => char.charCodeAt(0) < 32 && !'\n\r\t'.includes(char))) return { bytes, kind: 'omitted' }
    for (const secret of secrets) {
        if (!secret) continue
        for (const value of new Set([secret, encodeURIComponent(secret)])) text = text.replaceAll(value, '[已隐藏]')
    }
    if (/(?:cookie|authorization|password|token|formhash|session|secret|saltkey|fingerprint|captcha|_auth)\s*["']?\s*[:=]|\b[A-Za-z0-9+/_%-]{24,}={0,2}/i.test(text.replaceAll('[已隐藏]', ''))) return { bytes, kind: 'omitted' }
    return { bytes, kind: 'text', text: text.slice(0, TRACE_BODY_LIMIT), truncated: text.length > TRACE_BODY_LIMIT }
}

export function parsePage(html, account) {
    const author = html.match(/<a\b[^>]*class=["']author["'][^>]*>\s*([^<]+)\s*<\/a>/i)?.[1]?.trim()
    const uid = html.match(/discuz_uid\s*=\s*['"](\d+)['"]/)?.[1]
    if (!uid || uid === '0' || author !== account) throw new CheckinError('AUTH_REQUIRED', '登录态失效或账号不匹配，请在浏览器登录后更新 Cookie')
    const counters = {}
    for (const key of ['lxdays', 'lxlevel', 'lxreward', 'lxtdays']) {
        const raw = html.match(new RegExp('id="' + key + '"\\s+value="(\\d+)"'))?.[1]
        if (raw === undefined) throw new CheckinError('PAGE_CHANGED', '无法识别签到统计，已停止提交')
        counters[key] = Number(raw)
    }
    const signed = /class=["'][^"']*\bbtnvisted\b[^"']*["']/.test(html)
    const anchor = [...html.matchAll(/<a\b[^>]*>/gi)].find((match) => /\bJ_chkitot\b/.test(match[0]))?.[0]
    const href = anchor?.match(/href=["']([^"']+)["']/)?.[1]
    if (!signed && !href) throw new CheckinError('PAGE_CHANGED', '无法判断今日签到状态，已停止提交')
    return { account: author, uid, signed, counters, action: signed ? null : checkedAction(href) }
}

export async function locatePiece(image) {
    const { data, info } = await sharp(image, { limitInputPixels: 240 * 450 })
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true })
    const width = info.width,
        height = info.height / 3,
        channels = info.channels,
        pieceWidth = 50
    if (width !== 240 || height !== 150 || channels !== 3) throw new CheckinError('CAPTCHA_CHANGED', '验证图片格式变化，已停止提交')
    const opaque = (x, y) => {
        if (x < 0 || x >= pieceWidth || y < 0 || y >= height) return false
        const p = ((y + height) * width + x) * channels
        return data[p] + data[p + 1] + data[p + 2] > 35
    }
    const pixels = []
    for (let y = 2; y < height - 2; y++)
        for (let x = 2; x < pieceWidth - 2; x++) {
            let inside = true
            for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (!opaque(x + dx, y + dy)) inside = false
            if (inside) pixels.push([x, y])
        }
    if (pixels.length < 50) throw new CheckinError('CAPTCHA_AMBIGUOUS', '无法可靠识别验证图片，已停止提交')
    const scores = []
    for (let offset = 0; offset <= width - pieceWidth; offset++) {
        let error = 0
        for (const [x, y] of pixels) {
            const p = ((y + height) * width + x) * channels,
                q = ((y + height * 2) * width + x + offset) * channels
            for (let c = 0; c < 3; c++) error += Math.abs(data[p + c] - data[q + c])
        }
        scores.push({ offset, error: error / (pixels.length * 3) })
    }
    scores.sort((a, b) => a.error - b.error)
    const alternative = scores.find((item) => Math.abs(item.offset - scores[0].offset) > 4)
    const confidence = alternative.error / Math.max(scores[0].error, 0.01)
    if (scores[0].error > 35 || confidence < 1.3) throw new CheckinError('CAPTCHA_AMBIGUOUS', '验证图片匹配不确定，已停止提交')
    return { offset: scores[0].offset, confidence }
}

export function buildPayload(offset, timestamp = Date.now()) {
    // Match the reviewed public client protocol; never execute downloaded JavaScript.
    const publicKey = 'GWDiugh398huiw0ioOYGd0934hew'
    const duration = Math.round(600 + offset * 3)
    const points = Array.from({ length: 45 }, (_, i) => {
        const p = i / 44
        return { x: 100 + offset * (3 * p * p - 2 * p * p * p), y: 200 + 1.2 * Math.sin(p * Math.PI * 3), t: Math.round(duration * p) }
    })
    let totalDist = 0
    const speeds = [],
        directions = []
    for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x,
            dy = points[i].y - points[i - 1].y,
            dt = points[i].t - points[i - 1].t
        if (dt <= 0) continue
        const dist = Math.sqrt(dx * dx + dy * dy)
        totalDist += dist
        speeds.push(dist / dt)
        directions.push(Math.atan2(dy, dx))
    }
    const avgSpeed = speeds.reduce((a, b) => a + b, 0) / speeds.length
    const speedVar = speeds.reduce((sum, speed) => sum + Math.pow(speed - avgSpeed, 2), 0) / speeds.length
    const dirChanges = directions.slice(1).filter((angle, i) => Math.abs(angle - directions[i]) > Math.PI / 4).length
    const track = JSON.stringify({ valid: true, points: points.length, totalTime: points.at(-1).t, totalDist, avgSpeed, maxSpeed: Math.max(...speeds), minSpeed: Math.min(...speeds), speedVar, dirChanges, finalX: points.at(-1).x - points[0].x })
    const encrypted = Array.from(track, (char, i) => String.fromCharCode(char.charCodeAt(0) ^ publicKey.charCodeAt(i % publicKey.length))).join('')
    const normalizedOffset = offset.toFixed(2),
        combined = track + timestamp + normalizedOffset + publicKey
    let hash = 0x811c9dc5
    for (let i = 0; i < combined.length; i++) {
        hash ^= combined.charCodeAt(i)
        hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24)
    }
    return { duration, data: 'tn_r=' + normalizedOffset + '&track=' + encodeURIComponent(Buffer.from(encrypted, 'utf8').toString('base64')) + '&ts=' + timestamp + '&sign=' + (hash >>> 0).toString(16) }
}

export class LaowangClient {
    constructor(config) {
        this.config = config
        this.cookies = parseCookieHeader(config.cookie)
        this.agent = config.proxy ? new HttpsProxyAgent(config.proxy) : undefined
        this.postSent = false
        this.submissionTrace = null
        this.diagnostics = []
    }
    cookieHeader() {
        return [...this.cookies].map(([k, v]) => k + '=' + v).join('; ')
    }
    async step(name, task) {
        const started = Date.now()
        const trace = { name, startedAt: new Date(started).toISOString() }
        try {
            const result = await task()
            trace.outcome = result?.status >= 400 ? 'error' : 'ok'
            if (Number.isInteger(result?.status)) trace.httpStatus = result.status
            return result
        } catch (error) {
            trace.outcome = 'error'
            trace.code = error instanceof CheckinError ? error.code : 'INTERNAL'
            if (Number.isInteger(error?.httpStatus)) trace.httpStatus = error.httpStatus
            throw error
        } finally {
            this.diagnostics.push({ ...trace, durationMs: Math.max(0, Date.now() - started) })
        }
    }
    async request(route, { method = 'GET', data, final = false } = {}) {
        const url = new URL(route, SITE)
        if (url.origin !== SITE || /loginsubmit|action=logout/.test(url.search)) throw new CheckinError('BAD_ROUTE', '请求地址校验失败')
        if (url.searchParams.get('operation') === 'qiandao') {
            checkedAction(url.href)
            if ((method === 'POST') !== final || (final && this.postSent)) throw new CheckinError('DUPLICATE_POST', '已拦截重复签到提交')
        } else if (final) throw new CheckinError('BAD_ROUTE', '提交地址校验失败')
        const contentType = 'application/x-www-form-urlencoded'
        const sentCookies = final ? [...this.cookies.values()] : []
        if (final) {
            this.submissionTrace = {
                request: { method, url: traceUrl(url), contentType, fields: [...new URLSearchParams(data).keys()].map((name) => (['clicaptcha-submit-info', 'fingerprint'].includes(name) ? name : '参数')) }
            }
            this.postSent = true
        }
        let response
        try {
            response = await axios({ url: url.href, method, data, proxy: false, httpsAgent: this.agent, timeout: 15000, maxRedirects: 0, responseType: 'arraybuffer', maxContentLength: 4 * 1024 * 1024, maxBodyLength: 32768, validateStatus: () => true, headers: { 'User-Agent': USER_AGENT, Accept: '*/*', Cookie: this.cookieHeader(), Referer: SITE + SIGN_PAGE, ...(method === 'POST' ? { Origin: SITE, 'Content-Type': contentType } : {}) } })
        } catch (error) {
            const networkError = new CheckinError('NETWORK', error.code === 'ECONNABORTED' ? '站点请求超时' : '站点网络连接失败（' + (error.code || 'UNKNOWN') + '）')
            if (final) this.submissionTrace.error = networkError.message
            throw networkError
        }
        for (const item of response.headers['set-cookie'] || []) {
            const first = item.split(';')[0],
                index = first.indexOf('='),
                name = first.slice(0, index)
            if (index < 1 || !/^[A-Za-z0-9_]+$/.test(name)) continue
            if (/max-age=0(?:;|$)/i.test(item)) this.cookies.delete(name)
            else this.cookies.set(name, first.slice(index + 1))
        }
        const body = Buffer.from(response.data),
            text = body.toString('utf8')
        if (final) {
            const mime = String(response.headers['content-type'] || '').match(/^[a-z0-9.+-]+\/[a-z0-9.+-]+/i)?.[0]?.toLowerCase() || null
            this.submissionTrace.response = {
                status: response.status,
                location: traceLocation(response.headers.location),
                contentType: mime,
                body: traceBody(body, mime, [...sentCookies, ...this.cookies.values(), ...url.searchParams.getAll('formhash'), ...new URLSearchParams(data).values()])
            }
        }
        if (response.status === 403) throw Object.assign(new CheckinError('ACCESS_BLOCKED', '站点拒绝访问（403），请检查网络出口或更新 Cookie'), { httpStatus: 403 })
        return { status: response.status, body, text, headers: response.headers }
    }
    async inspect(phase) {
        const readPage = async () => {
            const started = Date.now()
            let page
            try {
                page = await this.request(SIGN_PAGE)
                if (page.status !== 200) throw new CheckinError('HTTP_STATUS', '读取签到页面失败（' + page.status + '）')
                return { ...parsePage(page.text, this.config.account), status: page.status }
            } catch (error) {
                const ray = page?.headers?.['cf-ray']
                throw Object.assign(error, {
                    httpStatus: page?.status ?? error.httpStatus,
                    inspectionDiagnostic: {
                        stage: page?.status === 200 ? '解析登录状态' : '读取签到页面',
                        durationMs: Date.now() - started,
                        connection: this.agent ? '代理' : '直连',
                        upstreamStatus: page?.status ?? error.httpStatus,
                        cfRay: typeof ray === 'string' && /^[a-f0-9]{16,32}(?:-[A-Z]{3})?$/i.test(ray) ? ray : undefined
                    }
                })
            }
        }
        return phase ? this.step(phase, readPage) : readPage()
    }
    async execute({ beforePost }) {
        const before = await this.inspect('initial_state')
        if (before.signed) return { status: 'already_signed', message: '今日已签到，已跳过提交', before: before.counters, after: before.counters, checkinPosts: 0 }
        if (!/^[a-f0-9]{32}$/i.test(this.config.fingerprint || '')) throw new CheckinError('FINGERPRINT_REQUIRED', '缺少站点浏览器标识，请先完成首次配置')
        const verification = await this.step('verification_page', () => this.request(before.action))
        if (verification.status !== 200 || !/id=["']v2_captcha_form["']/.test(verification.text)) throw new CheckinError('PAGE_CHANGED', '未收到预期的验证表单，已停止提交')
        const form = verification.text.match(/<form\b[^>]*id=["']v2_captcha_form["'][^>]*>/i)?.[0]
        const action = checkedAction(form?.match(/action=["']([^"']+)["']/)?.[1] || '')
        if (action !== before.action) throw new CheckinError('PAGE_CHANGED', '验证表单地址不一致，已停止提交')
        const script = await this.step('verification_resources', () => this.request('/captcha/tn_code.js'))
        if (script.status !== 200 || createHash('sha256').update(script.body).digest('hex') !== CLIENT_SHA256) throw new CheckinError('CAPTCHA_CHANGED', '站点验证脚本发生变化，需检查后更新')
        const image = await this.step('verification_image', () => this.request('/captcha/tncode.php?t=' + Date.now()))
        if (image.status !== 200 || !/^image\//.test(image.headers['content-type'] || '')) throw new CheckinError('CAPTCHA_CHANGED', '无法获取验证图片')
        const match = await this.step('verification_check', () => locatePiece(image.body)),
            payload = buildPayload(match.offset)
        await delay(payload.duration)
        const validation = await this.step('verification_result', () => this.request('/captcha/check.php', { method: 'POST', data: payload.data }))
        if (validation.status !== 200 || !/^[a-f0-9]{32}_ok$/i.test(validation.text.trim())) throw new CheckinError('CAPTCHA_REJECTED', '站点验证未通过，今日不自动重试')
        const data = new URLSearchParams({ 'clicaptcha-submit-info': validation.text.trim(), fingerprint: this.config.fingerprint }).toString()
        await beforePost()
        let responseStatus = null
        try {
            responseStatus = (await this.step('submit', () => this.request(action, { method: 'POST', data, final: true }))).status
        } catch (error) {
            if (!this.postSent) throw error
        }
        const after = await this.inspect('readback')
        if (after.signed && after.counters.lxtdays === before.counters.lxtdays + 1) return { status: 'success', message: '签到成功，已读回确认', before: before.counters, after: after.counters, checkinPosts: 1, responseStatus }
        throw new CheckinError('UNCONFIRMED', '已提交一次，但结果未确认；已停止重试，请查看站点状态')
    }
    close() {
        this.agent?.destroy()
    }
}
