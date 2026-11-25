import { createHash, timingSafeEqual } from 'node:crypto'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

export const MAX_ZIP_BYTES = 32 * 1024 * 1024
export const validJobId = (id) => /^[a-f0-9]{32}$/.test(id)
export const tokenConfigured = (token) => typeof token === 'string' && token.length > 0
export const updateAuthorization = (token) => 'GameReq ' + Buffer.from(token, 'utf8').toString('base64')
export const isAuthorized = (header, token) => {
    if (!tokenConfigured(token) || typeof header !== 'string') return false
    const expected = header.startsWith('Bearer ') ? 'Bearer ' + token : updateAuthorization(token)
    const digest = (value) => createHash('sha256').update(value).digest()
    return timingSafeEqual(digest(header), digest(expected))
}
export const managed = () => process.env.GAME_REQ_MANAGED_RELEASE === '1'
export const jobPath = (root, id) => {
    if (!validJobId(id)) throw new Error('无效的更新编号')
    return path.join(root, '.updates', id)
}
export const readJson = async (file) => JSON.parse(await fs.readFile(file, 'utf8'))
export async function writeJson(file, value) {
    await fs.writeFile(file + '.tmp', JSON.stringify(value) + '\n', { mode: 0o600 })
    await fs.rename(file + '.tmp', file)
}
export async function exists(file) {
    try {
        await fs.access(file)
        return true
    } catch (error) {
        if (error.code !== 'ENOENT') throw error
        return false
    }
}
