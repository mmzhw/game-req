import { transaction } from './admin/db.js'

const operationModes = new Set(['item', 'batch', 'command'])
const gameKey = /^[a-z][a-z0-9_-]{1,31}$/

const operation = (name, mode, url, params, options = {}) => ({
    name,
    mode,
    method: 'POST',
    url,
    params,
    ...(mode === 'batch' ? {
        batchItem: { id: '{{item.value}}', num: '{{number}}' },
        batchEncoding: 'string'
    } : {}),
    ...options
})
const conditional = (field, condition, value) => ({ $when: { field, ...condition }, $value: value })
const legacyOperations = (key, config) => {
    if (key === 'zcylt') return [operation('后台发送', 'item', config.url, { type: '{{item.action}}', checknum: config.checknum || 'ltzy.vip', uid: '{{account}}', item: '{{item.value}}', num: '{{number}}', qu: config.qid || '1' })]
    if (key === 'klssj') return [operation('后台发送', 'item', config.url, {
        action: '{{item.action}}', qid: config.qid || '1', uid: '{{account}}', pswd: config.password || 'ltzy',
        chargetype: conditional('item.action', { equals: 'sendmoney' }, '{{item.value}}'),
        chargenum: conditional('item.action', { equals: 'sendmoney' }, '{{number}}'),
        items: conditional('item.action', { notEquals: 'sendmoney' }, '{{items}}')
    })]
    if (key === 'xblr') return [operation('后台发送', 'batch', config.url, {
        action: 'send_items_batch', mail_title: config.mailTitle || '凌天众游', mail_content: config.mailContent || '凌天众游-您有新的邮件，请查收！',
        gm_pswd: config.password || '', items: '{{items}}'
    }, { batchLimit: config.batchLimit || 5, session: { resolveUrl: config.resolveUrl } })]
    const batch = operation('后台发送', 'batch', config.url, {
        action: '{{item.action}}', qid: config.qid || '1', uid: '{{account}}', pswd: config.password || '', items: '{{items}}'
    }, { batchLimit: config.batchLimit || 5 })
    if (key === 'zxr') return [batch, operation('清空背包', 'command', config.url, { action: 'clear_bag', qid: config.qid || '1001', uid: '{{account}}', pswd: config.password || '', confirm: '1' })]
    return [batch]
}

const defaults = [
    { key: 'zcylt', name: '这城有良田', sortOrder: 10, config: { url: 'http://115.231.220.134:8081/gm/user/gmquery.php', defaultAccount: 'mmzhw51', defaultNumber: 1, checknum: 'ltzy.vip', qid: '1' } },
    { key: 'klssj', name: '快乐水世界', sortOrder: 20, config: { url: 'http://111.170.152.157:90/gm/query.php', defaultAccount: 'mmzhw51', defaultNumber: 1, qid: '1', password: 'ltzy' } },
    { key: 'sc33t', name: '生成33天', sortOrder: 30, config: { url: 'http://111.170.152.149:8855/ht/query.php', defaultAccount: 'mmzhw52', defaultNumber: 1, qid: '1', password: 'ltzy', batchLimit: 5 } },
    { key: 'zxr', name: '镇邪人', sortOrder: 40, config: { url: 'http://115.231.8.162:8202/ht/gm/query.php', defaultAccount: 'mmzhw51', defaultNumber: 1, qid: '1001', password: '', batchLimit: 10 } },
    { key: 'xblr', name: '灵契不良人', sortOrder: 50, config: { url: 'http://115.231.8.159:9105/api.php', resolveUrl: 'http://115.231.8.159:9105/resolve.php', defaultAccount: 'mmzhw52', defaultNumber: 1, batchLimit: 5, mailTitle: '凌天众游', mailContent: '凌天众游-您有新的邮件，请查收！', password: '' } },
    { key: 'sgdbz', name: '时光大爆炸', sortOrder: 60, config: { url: 'http://115.231.8.162:8103/ht/gm/query.php', defaultAccount: 'mmzhw52', defaultNumber: 1, qid: '1', password: '361d8e4b44f4bbc8271ee2bd6fc1ad176cfd9e1263e06071', batchLimit: 5 } }
].map((game) => ({
    ...game,
    template: 'operations',
    config: {
        defaultAccount: game.config.defaultAccount,
        defaultNumber: game.config.defaultNumber,
        defaultInterval: 2.5,
        operations: legacyOperations(game.key, game.config)
    }
}))

const parseConfig = (value) => {
    try {
        return JSON.parse(value)
    } catch {
        return {}
    }
}

const publicGame = (row) => row && ({
    key: row.key,
    name: row.name,
    enabled: !!row.enabled,
    sortOrder: row.sortOrder,
    config: parseConfig(row.config),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
})

const normalize = (body, existingKey) => {
    const key = String(existingKey || body?.key || '').trim()
    const name = String(body?.name || '').trim()
    const enabled = body?.enabled === false ? 0 : 1
    const sortOrder = Number(body?.sortOrder || 0)
    const config = body?.config
    if (!gameKey.test(key)) throw Object.assign(new Error('游戏标识须以字母开头，只能包含小写字母、数字、下划线和连字符'), { status: 400 })
    if (!name || name.length > 40) throw Object.assign(new Error('游戏名称长度须为 1–40 个字符'), { status: 400 })
    if (!Number.isSafeInteger(sortOrder) || sortOrder < 0 || sortOrder > 9999) throw Object.assign(new Error('菜单排序须为 0–9999 的整数'), { status: 400 })
    if (!config || typeof config !== 'object' || Array.isArray(config)) throw Object.assign(new Error('游戏配置无效'), { status: 400 })
    const defaultInterval = Number(config.defaultInterval ?? 2.5)
    if (!Number.isFinite(defaultInterval) || defaultInterval < 0 || defaultInterval > 60) {
        throw Object.assign(new Error('默认发送间隔须为 0–60 秒'), { status: 400 })
    }
    const normalized = {
        defaultAccount: String(config.defaultAccount || '').slice(0, 128),
        defaultNumber: Math.max(1, Number(config.defaultNumber) || 1),
        defaultInterval
    }
    normalized.operations = (Array.isArray(config.operations) ? config.operations : []).map((operation, index) => {
        const name = String(operation?.name || '').trim()
        const mode = String(operation?.mode || '')
        if (!name || name.length > 40) throw Object.assign(new Error(`第 ${index + 1} 个功能名称无效`), { status: 400 })
        if (!operationModes.has(mode)) throw Object.assign(new Error(`第 ${index + 1} 个功能类型无效`), { status: 400 })
        let operationUrl
        try {
            operationUrl = new URL(String(operation.url || '')).href
        } catch {
            throw Object.assign(new Error(`第 ${index + 1} 个功能接口地址无效`), { status: 400 })
        }
        let params
        try {
            params = typeof operation.params === 'string' ? JSON.parse(operation.params) : operation.params
        } catch {
            throw Object.assign(new Error(`第 ${index + 1} 个功能参数不是有效 JSON`), { status: 400 })
        }
        if (!params || typeof params !== 'object' || Array.isArray(params)) throw Object.assign(new Error(`第 ${index + 1} 个功能参数须为 JSON 对象`), { status: 400 })
        let session
        if (operation.session?.resolveUrl) {
            try {
                session = { resolveUrl: new URL(String(operation.session.resolveUrl), operationUrl).href }
            } catch {
                throw Object.assign(new Error(`第 ${index + 1} 个功能会话绑定地址无效`), { status: 400 })
            }
        }
        let batchItem
        let batchEncoding
        if (mode === 'batch') {
            try {
                const configuredBatchItem = operation.batchItem ?? { id: '{{item.value}}', num: '{{number}}' }
                batchItem = typeof configuredBatchItem === 'string' ? JSON.parse(configuredBatchItem) : configuredBatchItem
            } catch {
                throw Object.assign(new Error(`第 ${index + 1} 个功能的单条物品结构不是有效 JSON`), { status: 400 })
            }
            if (!batchItem || typeof batchItem !== 'object' || Array.isArray(batchItem)) {
                throw Object.assign(new Error(`第 ${index + 1} 个功能的单条物品结构须为 JSON 对象`), { status: 400 })
            }
            batchEncoding = operation.batchEncoding === 'json' ? 'json' : 'string'
        }
        return {
            name,
            mode,
            url: operationUrl,
            method: String(operation.method || 'POST').toUpperCase() === 'GET' ? 'GET' : 'POST',
            batchLimit: Math.min(100, Math.max(1, Number(operation.batchLimit) || 1)),
            params,
            session,
            batchItem,
            batchEncoding
        }
    })
    if (!normalized.operations.length) throw Object.assign(new Error('游戏至少需要配置一个功能'), { status: 400 })
    return { key, name, template: 'operations', enabled, sortOrder, config: JSON.stringify(normalized) }
}

export class GamesRepository {
    constructor(db) {
        this.db = db
        db.exec(`
            CREATE TABLE IF NOT EXISTS app_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS games (
                key TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                template TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                sort_order INTEGER NOT NULL DEFAULT 0,
                config TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
        `)
        if (!db.prepare("SELECT 1 FROM app_meta WHERE key = 'games_seeded'").get()) {
            transaction(db, () => {
                const insert = db.prepare('INSERT OR IGNORE INTO games VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
                const now = new Date().toISOString()
                defaults.forEach((game) => insert.run(game.key, game.name, game.template, 1, game.sortOrder, JSON.stringify(game.config), now, now))
                db.prepare("INSERT INTO app_meta VALUES ('games_seeded', '1')").run()
            })
        }
        const migrate = db.prepare("UPDATE games SET template = 'operations', config = ?, updated_at = ? WHERE key = ?")
        db.prepare('SELECT key, config FROM games').all().forEach((row) => {
            const config = parseConfig(row.config)
            if (Array.isArray(config.operations) && config.operations.length) return
            const operations = legacyOperations(row.key, config)
            if (operations.length) migrate.run(JSON.stringify({
                defaultAccount: config.defaultAccount || '',
                defaultNumber: config.defaultNumber || 1,
                defaultInterval: Number(config.defaultInterval ?? 2.5),
                operations
            }), new Date().toISOString(), row.key)
        })
    }
    list({ enabledOnly = false } = {}) {
        const rows = this.db.prepare(`
            SELECT key, name, template, enabled, sort_order AS sortOrder, config, created_at AS createdAt, updated_at AS updatedAt
            FROM games ${enabledOnly ? 'WHERE enabled = 1' : ''}
            ORDER BY sort_order, name
        `).all()
        return rows.map(publicGame)
    }
    get(key) {
        const row = this.db.prepare(`
            SELECT key, name, template, enabled, sort_order AS sortOrder, config, created_at AS createdAt, updated_at AS updatedAt
            FROM games WHERE key = ?
        `).get(key)
        if (!row) throw Object.assign(new Error('游戏不存在'), { status: 404 })
        return publicGame(row)
    }
    create(body) {
        const game = normalize(body)
        const now = new Date().toISOString()
        try {
            this.db.prepare('INSERT INTO games VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(game.key, game.name, game.template, game.enabled, game.sortOrder, game.config, now, now)
        } catch (error) {
            if (/UNIQUE|PRIMARY KEY/.test(String(error.message))) throw Object.assign(new Error('游戏标识已存在'), { status: 409 })
            throw error
        }
        return this.get(game.key)
    }
    update(key, body) {
        this.get(key)
        const game = normalize(body, key)
        this.db.prepare(`
            UPDATE games SET name = ?, template = ?, enabled = ?, sort_order = ?, config = ?, updated_at = ? WHERE key = ?
        `).run(game.name, game.template, game.enabled, game.sortOrder, game.config, new Date().toISOString(), key)
        return this.get(key)
    }
    remove(key) {
        this.get(key)
        transaction(this.db, () => {
            const hasItems = this.db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'item_versions'").get()
            if (hasItems) {
                const versions = this.db.prepare('SELECT id FROM item_versions WHERE game = ?').all(key).map((row) => row.id)
                const removeRows = this.db.prepare('DELETE FROM item_rows WHERE version = ?')
                versions.forEach((id) => removeRows.run(id))
                this.db.prepare('DELETE FROM item_versions WHERE game = ?').run(key)
                this.db.prepare('DELETE FROM item_catalogs WHERE game = ?').run(key)
            }
            this.db.prepare('DELETE FROM games WHERE key = ?').run(key)
        })
    }
}

export function registerGameRoutes(router, games) {
    router.get('/api/games', (ctx) => { ctx.body = games.list() })
    router.get('/api/games/enabled', (ctx) => { ctx.body = games.list({ enabledOnly: true }) })
    router.get('/api/games/:key', (ctx) => { ctx.body = games.get(ctx.params.key) })
    router.post('/api/games', (ctx) => { ctx.body = games.create(ctx.request.body) })
    router.post('/api/games/:key', (ctx) => { ctx.body = games.update(ctx.params.key, ctx.request.body) })
    router.post('/api/games/:key/delete', (ctx) => {
        games.remove(ctx.params.key)
        ctx.status = 204
    })
}
