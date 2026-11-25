import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { createWriteStream } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import test from 'node:test'
import compressing from 'compressing'
import { stageBundle } from './bundle.js'
import { isAuthorized, jobPath, readJson, tokenConfigured, updateAuthorization } from './common.js'

const id = 'f'.repeat(32)
const version = '3.6.0'
const manifest = (kind) => ['release.json', JSON.stringify({ schema: 1, kind, version })]
const page = ['dist/index.html', '<!doctype html>']
const runtime = [['runtime/server.js', 'export {}'], ['runtime/package.json', JSON.stringify({ type: 'module', version })], ['runtime/pnpm-lock.yaml', 'lockfileVersion: "9.0"'], ['runtime/checkin/service.js', 'export {}']]

async function fixture(t, entries) {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'game-req-release-'))
    t.after(() => {
        const target = path.resolve(directory)
        assert.equal(path.dirname(target), path.resolve(os.tmpdir()))
        assert.ok(path.basename(target).startsWith('game-req-release-'))
        return fs.rm(target, { recursive: true, force: true })
    })
    const zip = new compressing.zip.Stream()
    for (const [name, value] of entries) zip.addEntry(Buffer.from(value), { relativePath: name })
    const file = path.join(directory, 'test.zip')
    await pipeline(zip, createWriteStream(file))
    return { directory, file }
}

test('front-end bundle stages only static files', async (t) => {
    const { directory, file } = await fixture(t, [manifest('frontend'), page])
    assert.deepEqual(await stageBundle(file, directory, 'frontend', id), { kind: 'frontend', version })
    assert.deepEqual(await fs.readdir(path.join(directory, 'next')), ['dist', 'release.json'])
})

test('server bundle stages separating runtime, modules and lockfile from static files', async (t) => {
    const { directory, file } = await fixture(t, [manifest('server'), page, ...runtime])
    assert.deepEqual(await stageBundle(file, directory, 'server', id), { kind: 'server', version })
    assert.deepEqual(await readJson(path.join(directory, 'next/runtime/.release.json')), { id, version })
    assert.equal(await fs.readFile(path.join(directory, 'next/runtime/checkin/service.js'), 'utf8'), 'export {}')
})

test('front-end entry rejects server payload and service entry rejects an incomplete package', async (t) => {
    const full = await fixture(t, [manifest('server'), page, ...runtime])
    await assert.rejects(() => stageBundle(full.file, full.directory, 'frontend', id), /不允许的文件/)
    const incomplete = await fixture(t, [manifest('server'), page, runtime[0]])
    await assert.rejects(() => stageBundle(incomplete.file, incomplete.directory, 'server', id), /缺少运行文件或依赖锁文件/)
})

test('bundle rejects archive paths pointing to deployment data', async (t) => {
    const { directory, file } = await fixture(t, [manifest('server'), page, ...runtime, ['runtime/data/config.json', '{}']])
    await assert.rejects(() => stageBundle(file, directory, 'server', id), /不允许的文件/)
})

test('updates require a nonempty exact token and bounded job path', () => {
    const token = 'h'.repeat(32)
    assert.equal(isAuthorized(undefined, token), false)
    assert.equal(isAuthorized('Bearer ' + token, 'short'), false)
    assert.equal(isAuthorized('Bearer ' + token, token), true)
    assert.equal(isAuthorized('Bearer ' + token + ' ', token), false)
    assert.equal(tokenConfigured(''), false)
    assert.equal(isAuthorized(updateAuthorization(''), ''), false)
    for (const value of ['x', ' 更新!$="🔑" ', 'a'.repeat(4096)]) {
        assert.equal(tokenConfigured(value), true)
        assert.equal(isAuthorized(updateAuthorization(value), value), true)
        assert.equal(isAuthorized(updateAuthorization(value + '!'), value), false)
    }
    assert.throws(() => jobPath('/opt/server', '../data'), /无效的更新编号/)
})
