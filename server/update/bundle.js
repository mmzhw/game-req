import fs from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import compressing from 'compressing'
import { readJson, writeJson } from './common.js'

const VERSION = /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/
const MAX_EXPANDED_BYTES = 96 * 1024 * 1024

function validEntry(name, kind, directory) {
    const parts = name.replace(/\/$/, '').split('/')
    if (!parts.every((part) => /^[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(part) && !part.endsWith('.') && !/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part))) return false
    if (name === 'release.json') return !directory
    if (parts[0] === 'dist') return directory || (parts.length > 1 && /\.(?:html|js|mjs|css|map|png|jpe?g|svg|gif|webp|avif|ico|woff2?|ttf|eot|json|txt|wasm)$/i.test(name))
    if (kind !== 'server' || parts[0] !== 'runtime' || parts.some((part) => /^(?:node_modules|data|logs|uploads|dist|tests?)$/i.test(part))) return false
    if (directory) return true
    return ['runtime/package.json', 'runtime/pnpm-lock.yaml'].includes(name) || /\.(?:js|mjs|cjs|json)$/i.test(name)
}

export async function stageBundle(zip, directory, kind, id) {
    const staging = path.join(directory, 'next')
    await fs.mkdir(staging, { recursive: true, mode: 0o700 })
    const entries = new Set()
    let bytes = 0
    await new Promise((resolve, reject) => {
        const input = new compressing.zip.UncompressStream({ source: zip, yauzl: { decodeStrings: true, strictFileNames: true } })
        input.once('error', reject)
        input.once('finish', resolve)
        input.on('entry', (header, stream, next) => {
            stream.on('error', reject)
            const name = header.name
            const directory = header.type === 'directory'
            const fileMode = header.mode & 0o170000
            const size = header.yauzl.uncompressedSize
            const key = name.replace(/\/$/, '').toLowerCase()
            if ((fileMode !== 0o100000 && !(directory && fileMode === 0o040000)) || !validEntry(name, kind, directory) || entries.has(key) || entries.size >= 3500 || !Number.isSafeInteger(size) || (bytes += size) > MAX_EXPANDED_BYTES) {
                stream.destroy()
                reject(new Error('更新包包含不允许的文件、重复路径或超出大小限制'))
                return
            }
            entries.add(key)
            const target = path.join(staging, name)
            const write = directory
                ? fs.mkdir(target, { recursive: true, mode: 0o755 })
                : fs.mkdir(path.dirname(target), { recursive: true, mode: 0o755 }).then(() => pipeline(stream, createWriteStream(target, { flags: 'wx', mode: 0o644 })))
            write.then(next, reject)
        })
    })
    const manifest = await readJson(path.join(staging, 'release.json')).catch(() => null)
    if (!manifest || manifest.schema !== 1 || manifest.kind !== kind || !VERSION.test(manifest.version) || !entries.has('dist/index.html')) throw new Error('更新包类型或清单不正确，请使用对应入口和新版构建包')
    if (kind === 'server') {
        for (const file of ['server.js', 'package.json', 'pnpm-lock.yaml']) {
            if (!entries.has('runtime/' + file)) throw new Error('服务端包缺少运行文件或依赖锁文件')
        }
        const runtime = path.join(staging, 'runtime')
        const pkg = await readJson(path.join(runtime, 'package.json'))
        if (pkg.type !== 'module' || pkg.version !== manifest.version || pkg.pnpm || pkg.packageManager || pkg.workspaces) throw new Error('服务端包的依赖清单不符合要求')
        await writeJson(path.join(runtime, '.release.json'), { id, version: manifest.version })
    }
    return { kind, version: manifest.version }
}
