import axios from 'axios'
import { Buffer } from 'node:buffer'
import { spawn } from 'node:child_process'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { CheckinError } from './laowang.js'

export const FNAT_SITE = 'https://frp.fnat.cc'
const PAGE = '/console/Sign'
const LOTTERY_PAGE = '/console/Lottery'
const LOTTERY_API = '/api/lottery.php'
const LOGIN_START = FNAT_SITE + '/auth/login'
const LOGIN_PAGE = 'http://frp.fnat.cc/auth/login/'
const LOGIN_SUBMIT = 'http://frp.fnat.cc/auth/login/login?r_u=%2F'
const SOLVER = fileURLToPath(new URL('./geetest_solver.py', import.meta.url))

export function solveFnatCaptcha(captchaId, proxy) {
    return new Promise((resolve, reject) => {
        const command = process.env.FNAT_PYTHON || (process.platform === 'win32' ? 'python' : 'python3')
        const child = spawn(command, [SOLVER], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
        let stdout = ''
        let stderr = ''
        const timer = setTimeout(() => {
            child.kill()
            reject(new CheckinError('CAPTCHA_TIMEOUT', 'FNAT 验证码求解超时'))
        }, 70000)
        child.stdout.on('data', (chunk) => {
            stdout += chunk
            if (stdout.length > 65536) child.kill()
        })
        child.stderr.on('data', (chunk) => {
            stderr += chunk
            if (stderr.length > 8192) child.kill()
        })
        child.on('error', () => {
            clearTimeout(timer)
            reject(new CheckinError('CAPTCHA_RUNTIME', 'FNAT 自动登录组件不可用，请检查 Python 与 PyPasser'))
        })
        child.on('close', (code) => {
            clearTimeout(timer)
            if (code !== 0) {
                reject(new CheckinError('CAPTCHA_FAILED', stderr.includes('ModuleNotFoundError') ? '未安装 FNAT 自动登录依赖 PyPasser' : 'FNAT 人机验证未通过'))
                return
            }
            try {
                const value = JSON.parse(stdout)
                if (!value.captcha_id || !value.lot_number || !value.pass_token) throw new Error()
                resolve(value)
            } catch {
                reject(new CheckinError('CAPTCHA_FAILED', 'FNAT 人机验证返回格式异常'))
            }
        })
        child.stdin.end(JSON.stringify({ captchaId, proxy }))
    })
}

export function parseFnatCookie(value) {
    const matches = typeof value === 'string' && !/[\r\n]/.test(value) ? [...value.matchAll(/(?:^|;)\s*PHPSESSID=([A-Za-z0-9,-]{1,256})(?=\s*(?:;|$))/g)] : []
    if (matches.length !== 1) throw new CheckinError('COOKIE_INVALID', '请获取包含 PHPSESSID 的 FNAT 登录 Cookie')
    return new Map([['PHPSESSID', matches[0][1]]])
}

function assertAccount(html, account) {
    if (typeof html !== 'string' || /id=["']loginForm["']/i.test(html)) throw new CheckinError('SESSION_EXPIRED', 'FNAT 登录态已失效，请手动登录后重新获取 Cookie')
    const name = html.match(/<p\b[^>]*\bclass=["'][^"']*\buser-name\b[^"']*["'][^>]*>([^<]+)<\/p>/i)?.[1].trim()
    if (!name) throw new CheckinError('UNKNOWN_PAGE', '未能识别 FNAT 登录页面信息')
    if (name !== account) throw new CheckinError('ACCOUNT_MISMATCH', 'FNAT Cookie 对应的账号与配置不一致')
}

export function parseFnatPage(html, account) {
    assertAccount(html, account)
    const unsigned = /您今天还没有签到哦/.test(html)
    const signed = /<h6\b[^>]*>[\s\S]{0,90}?(?:今日已签到|您今天已经签到|您今天已签到|今日签到已完成)/.test(html)
    if (signed === unsigned) throw new CheckinError('UNKNOWN_STATE', '未能确认 FNAT 今日签到状态')
    const csrf = html.match(/\bconst\s+csrf_token\s*=\s*(['"])([A-Za-z0-9_-]{8,256})\1/)?.[2]
    if (unsigned && !csrf) throw new CheckinError('CSRF_MISSING', '未获取到 FNAT 签到页面的验证字段')
    const days = html.match(/总计已签到\s*(\d+)\s*天/)
    return { account, signed, csrf, counters: days ? { lxtdays: Number(days[1]) } : null }
}

export class FnatClient {
    constructor(config, transport = axios, captchaSolver = solveFnatCaptcha) {
        this.config = config
        this.cookies = config.cookie ? parseFnatCookie(config.cookie) : new Map()
        this.agent = config.proxy ? new HttpsProxyAgent(config.proxy) : undefined
        this.transport = transport
        this.captchaSolver = captchaSolver
    }
    cookieHeader() {
        const session = this.cookies.get('PHPSESSID')
        return session ? 'PHPSESSID=' + session : ''
    }
    close() {
        this.agent?.destroy()
    }
    async get(path, options = {}) {
        return this.request('get', path, options)
    }
    updateCookies(response) {
        for (const item of response.headers?.['set-cookie'] || []) {
            const first = item.split(';')[0]
            const index = first.indexOf('=')
            if (index < 1 || first.slice(0, index) !== 'PHPSESSID') continue
            const value = first.slice(index + 1)
            if (value) this.cookies.set('PHPSESSID', value)
        }
    }
    async send(method, url, options = {}, body) {
        const cookie = this.cookieHeader()
        const requestOptions = {
            ...options,
            headers: { ...(cookie ? { Cookie: cookie } : {}), ...(options.headers || {}) },
            maxRedirects: 0,
            maxContentLength: 2 * 1024 * 1024,
            timeout: 30000,
            proxy: false,
            httpAgent: this.agent,
            httpsAgent: this.agent,
            validateStatus: () => true
        }
        const response = method === 'post'
            ? await this.transport.post(url, body, requestOptions)
            : await this.transport.get(url, requestOptions)
        this.updateCookies(response)
        return response
    }
    async request(method, path, options = {}, body) {
        const response = await this.send(method, FNAT_SITE + path, {
            ...options,
            headers: { Referer: FNAT_SITE + PAGE, ...(options.headers || {}) }
        }, body)
        if (method === 'post' && this.submissionTrace) {
            const json = response.data
            const safe = typeof json?.success === 'boolean' ? {
                success: json.success,
                need_verification: json.need_verification === true,
                prize: typeof json.data?.prize?.name === 'string' ? json.data.prize.name.slice(0, 120) : undefined
            } : null
            this.submissionTrace.response = {
                status: response.status,
                location: null,
                contentType: response.headers?.['content-type'] || null,
                body: { bytes: Buffer.byteLength(JSON.stringify(json) || ''), kind: safe ? 'text' : 'omitted', text: safe ? JSON.stringify(safe, null, 2) : undefined }
            }
        }
        if (response.status === 401 || (response.status >= 300 && response.status < 400 && String(response.headers?.location).includes('/auth/login'))) {
            throw new CheckinError('SESSION_EXPIRED', 'FNAT 登录态已失效，请手动登录后重新获取 Cookie')
        }
        if (response.status !== 200) throw new CheckinError('HTTP_ERROR', `FNAT 返回 HTTP ${response.status}`)
        return response.data
    }
    async login() {
        if (this.config.authMode !== 'password' || !this.config.password) throw new CheckinError('SESSION_EXPIRED', 'FNAT 登录态已失效，请重新获取 Cookie')
        if (!this.config.allowInsecureLogin) throw new CheckinError('INSECURE_LOGIN_DISABLED', 'FNAT 登录会降级到 HTTP，请先确认风险后启用账号密码登录')
        this.cookies.clear()
        const start = await this.send('get', LOGIN_START)
        if (start.status !== 301 || start.headers?.location !== LOGIN_PAGE) throw new CheckinError('LOGIN_CHANGED', 'FNAT 登录入口跳转发生变化，已停止自动登录')
        const page = await this.send('get', LOGIN_PAGE, { headers: { Referer: LOGIN_START } })
        if (page.status !== 200 || typeof page.data !== 'string') throw new CheckinError('LOGIN_CHANGED', '无法读取 FNAT 登录页面')
        const captchaId = page.data.match(/\bgt:\s*['"]([a-f0-9]{32})['"]/i)?.[1]
        if (!captchaId || !/id=["']loginForm["']/i.test(page.data)) throw new CheckinError('LOGIN_CHANGED', '未识别到 FNAT 登录验证参数')
        const verification = await this.captchaSolver(captchaId, this.config.proxy)
        const form = new URLSearchParams({
            username: this.config.account,
            password: this.config.password,
            geetest_challenge: verification.captcha_id,
            geetest_validate: verification.lot_number,
            geetest_seccode: verification.pass_token
        }).toString()
        const submitted = await this.send('post', LOGIN_SUBMIT, {
            headers: {
                Referer: LOGIN_PAGE,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }, form)
        const location = String(submitted.headers?.location || '')
        let loginSucceeded = false
        try {
            const redirected = new URL(location, LOGIN_SUBMIT)
            loginSucceeded = redirected.searchParams.get('status') === '200' || redirected.pathname.startsWith('/console/')
        } catch {
            loginSucceeded = false
        }
        if (submitted.status !== 302 || !loginSucceeded) throw new CheckinError('LOGIN_FAILED', 'FNAT 账号密码登录失败，请检查密码或平台风控状态')
        if (!this.cookies.get('PHPSESSID')) throw new CheckinError('LOGIN_FAILED', 'FNAT 登录后未返回有效会话')
    }
    async authenticatedGet(path, options = {}) {
        try {
            return await this.get(path, options)
        } catch (error) {
            if (!(error instanceof CheckinError) || error.code !== 'SESSION_EXPIRED' || this.config.authMode !== 'password') throw error
            await this.login()
            return this.get(path, options)
        }
    }
    async page() {
        return parseFnatPage(await this.authenticatedGet(PAGE), this.config.account)
    }
    async inspect() {
        const { account, signed, counters } = await this.page()
        return { account, signed, counters }
    }
    async draw({ beforePost }) {
        const headers = { Referer: FNAT_SITE + LOTTERY_PAGE }
        assertAccount(await this.authenticatedGet(LOTTERY_PAGE, { headers }), this.config.account)
        const result = await this.get(LOTTERY_API, { headers, params: { action: 'get_lottery_info' } })
        const configs = result?.data?.configs
        const free = Array.isArray(configs) ? configs.filter((config) => config?.cost_type === 'free') : []
        const wheel = free[0]
        const id = String(wheel?.id)
        const integer = (value) => /^\d+$/.test(String(value)) && Number.isSafeInteger(Number(value))
        if (result?.success !== true || free.length !== 1 || !/^[1-9]\d*$/.test(id) ||
            configs.filter((config) => String(config?.id) === id).length !== 1 ||
            !/^0(?:\.0+)?$/.test(String(wheel.cost_amount)) || !integer(wheel.daily_limit) ||
            Number(wheel.daily_limit) < 1 || !integer(wheel.user_daily_count)) {
            throw new CheckinError('LOTTERY_UNKNOWN', '无法确认零费用转盘和当日配额，已停止抽奖')
        }
        if (Number(wheel.user_daily_count) >= Number(wheel.daily_limit)) {
            return { status: 'skipped', message: 'FNAT 今日免费次数已用完', checkinPosts: 0 }
        }
        if (wheel.can_draw !== true || !Array.isArray(wheel.prizes) || wheel.prizes.length === 0) {
            throw new CheckinError('LOTTERY_UNAVAILABLE', 'FNAT 当前不允许免费抽奖')
        }
        const body = new FormData()
        body.append('action', 'draw')
        body.append('lottery_id', id)
        await beforePost()
        this.submissionTrace = {
            request: { method: 'POST', url: FNAT_SITE + LOTTERY_API, contentType: 'multipart/form-data', fields: ['action=draw', `lottery_id=${id}`] }
        }
        const drawn = await this.request('post', LOTTERY_API, {
            headers: { ...headers, Origin: FNAT_SITE }
        }, body)
        if (drawn?.success === false) {
            return { status: 'failed', message: drawn.need_verification ? 'FNAT 要求实名认证，请在平台处理' : 'FNAT 拒绝免费抽奖', checkinPosts: 1 }
        }
        if (drawn?.success !== true || !drawn.data || typeof drawn.data !== 'object') {
            throw new CheckinError('UNCONFIRMED', 'FNAT 未返回可识别的抽奖结果')
        }
        const prize = drawn.data.prize?.name
        return { status: 'success', message: typeof prize === 'string' && prize.trim() ? `FNAT 免费抽奖：${prize.trim().slice(0, 120)}` : 'FNAT 已确认免费抽奖完成', checkinPosts: 1 }
    }
    async execute({ beforePost }) {
        const state = await this.page()
        if (state.signed) return { status: 'skipped', message: 'FNAT 今日已签到', checkinPosts: 0 }
        await beforePost()
        const result = await this.get('/console/Signc/Sign', { params: { csrf: state.csrf }, headers: { 'X-Requested-With': 'XMLHttpRequest' } })
        const code = String(result?.code)
        if (code === '137') return { status: 'failed', message: 'FNAT 拒绝了签到（状态码 137）', checkinPosts: 1 }
        if (code !== '200') throw new CheckinError('UNCONFIRMED', 'FNAT 未返回可识别的签到结果')
        return { status: 'success', message: 'FNAT 已确认签到成功', checkinPosts: 1 }
    }
}
