import fs from 'node:fs/promises'
import { createWriteStream } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { pipeline } from 'node:stream/promises'
import { Buffer } from 'node:buffer'
import compressing from 'compressing'

const root = fileURLToPath(new URL('../', import.meta.url))
const server = path.join(root, 'server')
const version = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')).version
const staticFile = /\.(?:html|js|mjs|css|map|png|jpe?g|svg|gif|webp|avif|ico|woff2?|ttf|eot|json|txt|wasm)$/i
const runtimeFile = /\.(?:js|mjs|cjs|json)$/i
const ignoredRuntime = new Set(['dist', 'uploads', 'data', 'logs', 'node_modules', 'tests', 'watch.js', 'zip.js', 'version.js', 'ecosystem.config.cjs', 'supervisor.js'])

async function collectFiles(entries, source, destination, allow, exclude = () => false) {
    for (const entry of await fs.readdir(source, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || exclude(entry.name)) continue
        const local = path.join(source, entry.name)
        const relativePath = destination + '/' + entry.name
        if (entry.isDirectory()) await collectFiles(entries, local, relativePath, allow, exclude)
        else if (entry.isFile() && allow.test(entry.name)) entries.push([local, { relativePath }])
    }
}

await fs.access(path.join(server, 'dist', 'index.html'))
for (const [kind, filename] of [['frontend', 'dist.zip'], ['server', 'release.zip']]) {
    const entries = []
    await collectFiles(entries, path.join(server, 'dist'), 'dist', staticFile, (name) => ['server.js', 'watch.js', 'checkin'].includes(name))
    if (kind === 'server') {
        await collectFiles(entries, server, 'runtime', runtimeFile, (name) => ignoredRuntime.has(name) || name.endsWith('.test.js'))
        for (const name of ['package.json', 'pnpm-lock.yaml']) entries.push([path.join(root, name), { relativePath: 'runtime/' + name }])
    }
    const zip = new compressing.zip.Stream()
    const output = path.join(server, filename)
    const write = pipeline(zip, createWriteStream(output + '.tmp'))
    for (const [source, options] of entries) zip.addEntry(source, options)
    zip.addEntry(Buffer.from(JSON.stringify({ schema: 1, kind, version })), { relativePath: 'release.json' })
    await write
    await fs.rename(output + '.tmp', output)
    console.log(`已生成 ${filename} (${version})`)
}
