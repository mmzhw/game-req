import axios from 'axios'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { CheckinError } from './laowang.js'

export const FNAT_SITE = 'https://frp.fnat.cc'
const PAGE = '/console/Sign'

export function parseFnatCookie(value) {
    const matches = typeof value === 'string' && !/[\r\n]/.test(value) ? [...value.matchAll(/(?:^|;)\s*PHPSESSID=([A-Za-z0-9,-]{1,256})(?=\s*(?:;|$))/g)] : []
    if (matches.length !== 1) throw new CheckinError('COOKIE_INVALID', '请获取包含 PHPSESSID 的 FNAT 登录 Cookie')
    return new Map([['PHPSESSID', matches[0][1]]])
}

export function parseFnatPage(html, account) {
    if (typeof html !== 'string' || /id=["']loginForm["']/i.test(html)) throw new CheckinError('SESSION_EXPIRED', 'FNAT 登录态已失效，请手动登录后重新获取 Cookie')
    const name = html.match(/<p\b[^>]*\bclass=["'][^"']*\buser-name\b[^"']*["'][^>]*>([^<]+)<\/p>/i)?.[1].trim()
    if (!name) throw new CheckinError('UNKNOWN_PAGE', '未能识别 FNAT 签到页面')
    if (name !== account) throw new CheckinError('ACCOUNT_MISMATCH', 'FNAT Cookie 对应的账号与配置不一致')
    const unsigned = /您今天还没有签到哦/.test(html)
    const signed = /<h6\b[^>]*>[\s\S]{0,90}?(?:今日已签到|您今天已经签到|您今天已签到|今日签到已完成)/.test(html)
    if (signed === unsigned) throw new CheckinError('UNKNOWN_STATE', '未能确认 FNAT 今日签到状态')
    const csrf = html.match(/\bconst\s+csrf_token\s*=\s*(['"])([A-Za-z0-9_-]{8,256})\1/)?.[2]
    if (unsigned && !csrf) throw new CheckinError('CSRF_MISSING', '未获取到 FNAT 签到页面的验证字段')
    const days = html.match(/总计已签到\s*(\d+)\s*天/)
    return { account, signed, csrf, counters: days ? { lxtdays: Number(days[1]) } : null }
}

export class FnatClient {
    constructor(config, transport = axios) {
        this.config = config
        this.cookies = parseFnatCookie(config.cookie)
        this.agent = config.proxy ? new HttpsProxyAgent(config.proxy) : undefined
        this.transport = transport
    }
    cookieHeader() {
        return 'PHPSESSID=' + this.cookies.get('PHPSESSID')
    }
    close() {
        this.agent?.destroy()
    }
    async get(path, options = {}) {
        const response = await this.transport.get(FNAT_SITE + path, {
            ...options,
            headers: { Cookie: this.cookieHeader(), Referer: FNAT_SITE + PAGE, ...(options.headers || {}) },
            maxRedirects: 0,
            maxContentLength: 2 * 1024 * 1024,
            timeout: 15000,
            proxy: false,
            httpsAgent: this.agent,
            validateStatus: () => true
        })
        if (response.status === 401 || (response.status >= 300 && response.status < 400 && String(response.headers?.location).includes('/auth/login'))) {
            throw new CheckinError('SESSION_EXPIRED', 'FNAT 登录态已失效，请手动登录后重新获取 Cookie')
        }
        if (response.status !== 200) throw new CheckinError('HTTP_ERROR', `FNAT 返回 HTTP ${response.status}`)
        return response.data
    }
    async page() {
        return parseFnatPage(await this.get(PAGE), this.config.account)
    }
    async inspect() {
        const { account, signed, counters } = await this.page()
        return { account, signed, counters }
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
