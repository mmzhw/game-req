import { Buffer } from 'node:buffer'
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import path from 'node:path'
import { transaction } from './db.js'

const derive = promisify(scrypt)
const COOKIE = 'game_req_session'
const SESSION_MS = 12 * 60 * 60 * 1000
const WINDOW_MS = 60 * 1000
const hash = (value) => createHash('sha256').update(value).digest()
const token = () => randomBytes(32).toString('hex')
const validToken = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
const hasPassword = (value) => typeof value === 'string' && value.length > 0

export class AdminAuth {
    constructor(db, { secure = false, now = Date.now } = {}) {
        this.db = db
        this.secure = secure
        this.now = now
        this.attempts = { until: 0, count: 0, pending: 0 }
        db.exec(`
            CREATE TABLE IF NOT EXISTS admin (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                username TEXT NOT NULL,
                salt TEXT NOT NULL,
                password_hash BLOB NOT NULL
            );
            CREATE TABLE IF NOT EXISTS admin_sessions (
                token_hash BLOB PRIMARY KEY,
                expires_at INTEGER NOT NULL
            );
        `)
    }
    user() {
        return this.db.prepare('SELECT username FROM admin WHERE id = 1').get()
    }
    session(value) {
        return validToken(value) && !!this.db.prepare('SELECT 1 FROM admin_sessions WHERE token_hash = ? AND expires_at > ?').get(hash(value), this.now())
    }
    requestSession(request) {
        const cookie = request.headers.cookie?.match(/(?:^|;\s*)game_req_session=([^;]+)/)?.[1]
        return this.session(cookie)
    }
    setCookie(ctx, value) {
        ctx.cookies.set(COOKIE, value, { httpOnly: true, sameSite: 'strict', secure: this.secure || ctx.secure, overwrite: true, path: '/', maxAge: value ? SESSION_MS : 0 })
    }
    startSession(ctx, expectedSalt) {
        const value = token()
        transaction(this.db, () => {
            if (expectedSalt && this.db.prepare('SELECT salt FROM admin WHERE id = 1').get()?.salt !== expectedSalt) {
                ctx.throw(401, '用户名或密码不正确')
            }
            this.db.prepare('DELETE FROM admin_sessions WHERE expires_at <= ?').run(this.now())
            const previous = ctx.cookies.get(COOKIE)
            if (validToken(previous)) this.db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(hash(previous))
            this.db.prepare('INSERT INTO admin_sessions VALUES (?, ?)').run(hash(value), this.now() + SESSION_MS)
        })
        this.setCookie(ctx, value)
    }
    async limited(ctx, work) {
        const attempts = this.attempts
        if (attempts.until <= this.now()) {
            attempts.until = this.now() + WINDOW_MS
            attempts.count = 0
        }
        if (attempts.count >= 10 || attempts.pending >= 2) ctx.throw(429, '尝试次数过多，请一分钟后再试')
        attempts.count++
        attempts.pending++
        try {
            await work()
        } finally {
            attempts.pending--
        }
    }
    async setup(ctx) {
        if (this.user()) ctx.throw(409, '管理员已创建，请登录')
        const { username, password } = ctx.request.body || {}
        const name = typeof username === 'string' ? username.trim() : ''
        if (!/^[\p{L}\p{N}_.-]{2,32}$/u.test(name)) {
            ctx.throw(400, '用户名须为 2–32 位字母、数字或 _.-')
        }
        if (!hasPassword(password)) ctx.throw(400, '请输入密码')
        const salt = randomBytes(16).toString('hex')
        const passwordHash = await derive(password, salt, 64)
        transaction(this.db, () => {
            if (this.user()) ctx.throw(409, '管理员已创建，请登录')
            this.db.prepare('INSERT INTO admin VALUES (1, ?, ?, ?)').run(name, salt, passwordHash)
        })
        this.startSession(ctx)
        ctx.status = 201
        ctx.body = { username: name }
    }
    async login(ctx) {
        const { username, password } = ctx.request.body || {}
        if (typeof username !== 'string' || !hasPassword(password)) ctx.throw(400, '请填写用户名和密码')
        const row = this.db.prepare('SELECT username, salt, password_hash FROM admin WHERE id = 1').get()
        const derived = await derive(password, row?.salt || 'game-req-uninitialized', 64)
        if (!row || !timingSafeEqual(derived, row.password_hash) || username.trim() !== row.username) ctx.throw(401, '用户名或密码不正确')
        this.startSession(ctx, row.salt)
        ctx.body = { username: row.username }
    }
    register(router) {
        router.get('/api/auth/status', (ctx) => {
            const user = this.user()
            ctx.body = { setupRequired: !user, username: user && this.session(ctx.cookies.get(COOKIE)) ? user.username : null }
        })
        router.post('/api/auth/setup', (ctx) => this.limited(ctx, () => this.setup(ctx)))
        router.post('/api/auth/login', (ctx) => this.limited(ctx, () => this.login(ctx)))
        router.post('/api/auth/logout', (ctx) => {
            const value = ctx.cookies.get(COOKIE)
            if (validToken(value)) this.db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(hash(value))
            this.setCookie(ctx, null)
            ctx.status = 204
        })
    }
    guard() {
        const publicRoutes = new Set(['GET /api/auth/status', 'POST /api/auth/setup', 'POST /api/auth/login', 'GET /api/update/health'])
        return async (ctx, next) => {
            let route
            try {
                route = path.posix.normalize('/' + decodeURIComponent(ctx.path).replaceAll('\\', '/')).replace(/\/+$/, '').toLowerCase()
            } catch {
                ctx.throw(400, '请求路径无效')
            }
            const protectedAsset = route.startsWith('/assets/game-options-')
            if (!protectedAsset && route !== '/api' && !route.startsWith('/api/') && !['/upload', '/uploadserver', '/restart'].includes(route)) return next()
            ctx.set('Cache-Control', 'no-store')
            if (!['GET', 'HEAD', 'OPTIONS'].includes(ctx.method) && (ctx.get('X-Game-Req') !== '1' || ctx.get('Sec-Fetch-Site') === 'cross-site')) {
                ctx.throw(403, '请从当前后台页面操作')
            }
            if (!publicRoutes.has(`${ctx.method} ${route}`) && !this.session(ctx.cookies.get(COOKIE))) ctx.throw(401, '请先登录')
            await next()
        }
    }
    async resetPassword(password) {
        if (!hasPassword(password)) throw new Error('请输入新密码')
        if (!this.user()) throw new Error('管理员尚未创建')
        const salt = randomBytes(16).toString('hex')
        const passwordHash = await derive(password, salt, 64)
        transaction(this.db, () => {
            this.db.prepare('UPDATE admin SET salt = ?, password_hash = ? WHERE id = 1').run(salt, passwordHash)
            this.db.exec('DELETE FROM admin_sessions')
        })
    }
}
