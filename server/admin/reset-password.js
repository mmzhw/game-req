import { readFileSync } from 'node:fs'
import { AdminAuth } from './auth.js'
import { adminDatabaseFile, openDatabase } from './db.js'

try {
    if (process.stdin.isTTY) throw new Error('请从 stdin 传入新密码')
    const password = readFileSync(0, 'utf8').replace(/\r?\n$/, '')
    const db = openDatabase(adminDatabaseFile)
    try {
        await new AdminAuth(db).resetPassword(password)
        console.log('管理员密码已更新，旧会话已撤销')
    } finally {
        db.close()
    }
} catch (error) {
    console.error(error.message)
    process.exitCode = 1
}
