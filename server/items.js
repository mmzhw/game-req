import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { transaction } from './admin/db.js'

const MAX_BYTES = 2 * 1024 * 1024
const itemFile = /^([a-z0-9_-]+)\.(txt|text|json)$/
const pageSizeFor = (value) => Math.min(positive(value, 50), 5000)
const positive = (value, fallback) => Number.isSafeInteger(Number(value)) && Number(value) > 0 ? Number(value) : fallback
const nonnegative = (value, fallback) => Number.isSafeInteger(Number(value)) && Number(value) >= 0 ? Number(value) : fallback

const getPath = (value, field) => {
    const path = String(field || '').trim()
    if (!path) return value
    return path.split('.').reduce((current, key) => current?.[key], value)
}

const normalizeMapping = (mapping) => {
    if (!mapping || typeof mapping !== 'object' || Array.isArray(mapping)) return null
    return {
        listPath: String(mapping.listPath || '').trim(),
        namePath: String(mapping.namePath || '').trim(),
        valuePath: String(mapping.valuePath || '').trim(),
        actionMode: mapping.actionMode === 'field' ? 'field' : 'fixed',
        actionPath: String(mapping.actionPath || '').trim(),
        actionValue: String(mapping.actionValue ?? '').slice(0, 128)
    }
}

const parseJsonValue = (text) => {
    let value = JSON.parse(text.replace(/^\uFEFF/, ''))
    for (let depth = 0; depth < 2 && typeof value === 'string'; depth++) value = JSON.parse(value)
    return value
}

const mappedRows = (value, mapping) => {
    let rows = getPath(value, mapping.listPath)
    if (!mapping.listPath && !Array.isArray(rows) && rows && typeof rows === 'object') {
        const arrays = Object.values(rows).filter(Array.isArray)
        if (arrays.length === 1) rows = arrays[0]
    }
    if (!Array.isArray(rows)) return { error: mapping.listPath ? `列表路径“${mapping.listPath}”不是数组` : '粘贴内容不是数组；如果数组位于对象中，请填写列表路径' }
    if (!mapping.namePath || !mapping.valuePath) return { error: '名称字段和 ID 字段不能为空' }
    return {
        rows: rows.map((item) => ({
            value: getPath(item, mapping.valuePath),
            name: getPath(item, mapping.namePath),
            action: mapping.actionMode === 'field' ? getPath(item, mapping.actionPath) : mapping.actionValue
        }))
    }
}

export function parseItemCatalog(text, rawMapping) {
    if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_BYTES) return { error: '目录文件须为 UTF-8 文本，大小不超过 2 MB' }
    const mapping = normalizeMapping(rawMapping)
    let value
    try {
        value = parseJsonValue(text)
    } catch {
        return { error: '内容不是有效的 JSON 或 JSON 字符串' }
    }
    const converted = mapping ? mappedRows(value, mapping) : { rows: value }
    if (converted.error) return converted
    const rows = converted.rows
    if (!Array.isArray(rows) || !rows.length || rows.length > 50000) return { error: '文件须包含 1–50000 条物品的 JSON 数组' }
    const ids = new Map(), names = new Map(), actions = Object.create(null), issues = []
    let invalid = 0, unnamed = 0
    for (const [index, item] of rows.entries()) {
        const valueOk = (typeof item?.value === 'string' && item.value.trim() && item.value.length <= 128) || Number.isSafeInteger(item?.value)
        const actionOk = typeof item?.action === 'string' && item.action.length <= 128
        if (!valueOk || typeof item?.name !== 'string' || item.name.length > 512 || !actionOk) {
            invalid++
            if (issues.length < 10) issues.push(index + 1)
            continue
        }
        const id = String(item.value)
        ids.set(id, (ids.get(id) || 0) + 1)
        if (item.name.trim()) names.set(item.name, (names.get(item.name) || 0) + 1)
        else unnamed++
        const action = item.action || '(空)'
        actions[action] = (actions[action] || 0) + 1
    }
    const groups = (counts) => [...counts.values()].filter((count) => count > 1).length
    const digest = JSON.stringify({ text, mapping })
    return {
        rows,
        summary: {
            count: rows.length,
            invalid,
            issues,
            unnamed,
            duplicateValues: groups(ids),
            duplicateNames: groups(names),
            actions,
            sample: rows.slice(0, 3),
            sha256: createHash('sha256').update(digest).digest('hex')
        }
    }
}

export class ItemsRepository {
    constructor(db) {
        this.db = db
        db.exec(`
            CREATE TABLE IF NOT EXISTS item_catalogs (
                game TEXT PRIMARY KEY,
                active_version INTEGER,
                FOREIGN KEY (game, active_version) REFERENCES item_versions(game, id)
            );
            CREATE TABLE IF NOT EXISTS item_versions (
                id INTEGER PRIMARY KEY,
                game TEXT NOT NULL REFERENCES item_catalogs(game),
                source TEXT NOT NULL,
                sha256 TEXT NOT NULL,
                count INTEGER NOT NULL,
                imported_at TEXT NOT NULL,
                UNIQUE(game, id),
                UNIQUE(game, sha256)
            );
            CREATE TABLE IF NOT EXISTS item_rows (
                version INTEGER NOT NULL REFERENCES item_versions(id),
                position INTEGER NOT NULL,
                name TEXT NOT NULL,
                data TEXT NOT NULL,
                PRIMARY KEY(version, position)
            ) WITHOUT ROWID;
        `)
        transaction(db, () => {
            db.prepare(`
                DELETE FROM item_rows
                WHERE version IN (
                    SELECT version.id
                    FROM item_versions version
                    JOIN item_catalogs catalog ON catalog.game = version.game
                    WHERE version.id != catalog.active_version
                )
            `).run()
            db.prepare(`
                DELETE FROM item_versions
                WHERE id NOT IN (
                    SELECT active_version FROM item_catalogs WHERE active_version IS NOT NULL
                )
            `).run()
        })
    }
    catalogs() {
        return this.db.prepare(`
            SELECT catalog.game, version.source, version.count, version.imported_at AS importedAt
            FROM item_catalogs catalog
            JOIN item_versions version ON version.id = catalog.active_version
            ORDER BY catalog.game
        `).all()
    }
    ensureGame(game) {
        if (!this.db.prepare('SELECT 1 FROM games WHERE key = ?').get(game)) throw Object.assign(new Error('游戏不存在'), { status: 404 })
    }
    catalog(game) {
        return this.catalogs().find((row) => row.game === game) || null
    }
    active(game) {
        const row = this.db.prepare('SELECT active_version AS id FROM item_catalogs WHERE game = ?').get(game)
        if (!row?.id) throw Object.assign(new Error('物品目录不存在'), { status: 404 })
        return row.id
    }
    replace(game, source, { rows, summary }, { seed = false } = {}) {
        return transaction(this.db, () => {
            this.ensureGame(game)
            const active = this.db.prepare('SELECT active_version AS id FROM item_catalogs WHERE game = ?').get(game)?.id
            if (seed && active) return active
            if (!active) this.db.prepare('INSERT INTO item_catalogs(game) VALUES (?)').run(game)
            const existing = this.db.prepare('SELECT id FROM item_versions WHERE game = ? AND sha256 = ?').get(game, summary.sha256)
            const id = existing?.id ?? this.db.prepare('INSERT INTO item_versions(game, source, sha256, count, imported_at) VALUES (?, ?, ?, ?, ?)')
                .run(game, source, summary.sha256, rows.length, new Date().toISOString()).lastInsertRowid
            if (!existing) {
                const insert = this.db.prepare('INSERT INTO item_rows VALUES (?, ?, ?, ?)')
                rows.forEach((item, position) => insert.run(id, position, item.name, JSON.stringify(item)))
            }
            this.db.prepare('UPDATE item_catalogs SET active_version = ? WHERE game = ?').run(id, game)
            this.db.prepare('DELETE FROM item_rows WHERE version IN (SELECT id FROM item_versions WHERE game = ? AND id != ?)').run(game, id)
            this.db.prepare('DELETE FROM item_versions WHERE game = ? AND id != ?').run(game, id)
            return id
        })
    }
    async seed(dir) {
        const files = await fs.readdir(dir).catch((error) => {
            if (error.code !== 'ENOENT') throw error
            return []
        })
        const current = new Set(this.catalogs().map((row) => row.game))
        for (const name of files.sort()) {
            const game = name.match(itemFile)?.[1]
            if (!game || current.has(game) || !this.db.prepare('SELECT 1 FROM games WHERE key = ?').get(game)) continue
            const bytes = await fs.readFile(path.join(dir, name))
            const catalog = parseItemCatalog(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
            if (catalog.error || catalog.summary.invalid) throw new Error(`物品种子目录校验失败：${name}`)
            this.replace(game, name, catalog, { seed: true })
            current.add(game)
        }
    }
    query(game, { keyword = '', page = 1, pageSize = 50 } = {}) {
        const version = this.active(game)
        const search = String(keyword).trim()
        const limit = pageSizeFor(pageSize)
        const filter = 'WHERE version = ? AND instr(name, ?) > 0'
        const { total } = this.db.prepare(`SELECT count(*) AS total FROM item_rows ${filter}`).get(version, search)
        const current = Math.min(positive(page, 1), Math.max(1, Math.ceil(total / limit)))
        const rows = this.db.prepare(`SELECT position, data FROM item_rows ${filter} ORDER BY position LIMIT ? OFFSET ?`).all(version, search, limit, (current - 1) * limit)
        return { list: rows.map((row) => ({ ...JSON.parse(row.data), _position: row.position })), total, page: current, pageSize: limit }
    }
    locate(game, { keyword = '', after = -1, pageSize = 50 } = {}) {
        const version = this.active(game)
        const search = String(keyword).trim()
        const cursor = Number(after)
        if (!search) return { found: false }
        const row = this.db.prepare('SELECT position, data FROM item_rows WHERE version = ? AND position > ? AND instr(name, ?) > 0 ORDER BY position LIMIT 1')
            .get(version, Number.isSafeInteger(cursor) ? Math.max(cursor, -1) : -1, search)
        if (!row) return { found: false }
        return { found: true, index: row.position, page: Math.floor(row.position / pageSizeFor(pageSize)) + 1, item: JSON.parse(row.data) }
    }
    saveItem(game, position, item) {
        this.ensureGame(game)
        const catalog = parseItemCatalog(JSON.stringify([item]))
        if (catalog.error || catalog.summary.invalid) throw Object.assign(new Error(catalog.error || '物品数据无效'), { status: 400 })
        const version = this.active(game)
        return transaction(this.db, () => {
            if (position === null || position === undefined) {
                const { next } = this.db.prepare('SELECT coalesce(max(position), -1) + 1 AS next FROM item_rows WHERE version = ?').get(version)
                this.db.prepare('INSERT INTO item_rows VALUES (?, ?, ?, ?)').run(version, next, item.name, JSON.stringify(item))
                this.db.prepare('UPDATE item_versions SET count = count + 1 WHERE id = ?').run(version)
                return next
            }
            const changed = this.db.prepare('UPDATE item_rows SET name = ?, data = ? WHERE version = ? AND position = ?')
                .run(item.name, JSON.stringify(item), version, nonnegative(position, -1))
            if (!changed.changes) throw Object.assign(new Error('物品不存在'), { status: 404 })
            return Number(position)
        })
    }
    removeItem(game, position) {
        const version = this.active(game)
        const changed = this.db.prepare('DELETE FROM item_rows WHERE version = ? AND position = ?').run(version, nonnegative(position, -1))
        if (!changed.changes) throw Object.assign(new Error('物品不存在'), { status: 404 })
        this.db.prepare('UPDATE item_versions SET count = count - 1 WHERE id = ?').run(version)
    }
}

export function registerItemsRoutes(router, repository) {
    router.get('/api/items/catalogs', (ctx) => { ctx.body = repository.catalogs() })
    router.get('/api/items/:game', (ctx) => { ctx.body = repository.query(ctx.params.game, ctx.query) })
    router.get('/api/items/:game/locate', (ctx) => { ctx.body = repository.locate(ctx.params.game, ctx.query) })
    router.post('/api/items/:game/import/preview', (ctx) => {
        repository.ensureGame(ctx.params.game)
        const catalog = parseItemCatalog(ctx.request.body?.text, ctx.request.body?.mapping)
        if (catalog.error) ctx.throw(400, catalog.error)
        ctx.body = catalog.summary
    })
    router.post('/api/items/:game/import/confirm', (ctx) => {
        const game = ctx.params.game
        repository.ensureGame(game)
        const { text, source, sha256, mapping } = ctx.request.body || {}
        const catalog = parseItemCatalog(text, mapping)
        if (catalog.error || catalog.summary.invalid) ctx.throw(400, catalog.error || '目录包含无效条目')
        if (catalog.summary.sha256 !== sha256) ctx.throw(409, '文件内容已改变，请重新预览')
        if (typeof source !== 'string' || !/\.(txt|text|json)$/i.test(source) || source.length > 200 || /[/\\\x00-\x1f]/.test(source)) ctx.throw(400, '导入来源名称无效')
        const id = repository.replace(game, source, catalog)
        ctx.body = { id }
    })
    router.post('/api/items/:game/item', (ctx) => {
        const { position, item } = ctx.request.body || {}
        ctx.body = { position: repository.saveItem(ctx.params.game, position, item) }
    })
    router.post('/api/items/:game/item/delete', (ctx) => {
        repository.removeItem(ctx.params.game, ctx.request.body?.position)
        ctx.status = 204
    })
}
