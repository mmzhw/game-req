import { mkdirSync, openSync, closeSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

export const dataDir = path.resolve(process.env.GAME_REQ_DATA_DIR || fileURLToPath(new URL('../data/', import.meta.url)))
export const adminDatabaseFile = path.join(dataDir, 'app.db')

export function openDatabase(file) {
    mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
    closeSync(openSync(file, 'a', 0o600))
    const db = new DatabaseSync(file)
    db.exec('PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;')
    return db
}

export function transaction(db, work) {
    db.exec('BEGIN IMMEDIATE')
    try {
        const result = work()
        db.exec('COMMIT')
        return result
    } catch (error) {
        db.exec('ROLLBACK')
        throw error
    }
}
