import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { openDatabase } from './admin/db.js'
import { GamesRepository } from './games.js'

test('games can be created, edited, disabled and permanently deleted', async (context) => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-req-games-'))
    const file = path.join(dir, 'items.db')
    const db = openDatabase(file)
    context.after(async () => {
        db.close()
        await fs.rm(dir, { recursive: true, force: true })
    })
    const games = new GamesRepository(db)
    assert.equal(games.list().length, 6)
    const created = games.create({
        key: 'demo_game',
        name: '测试游戏',
        sortOrder: 70,
        config: {
            defaultAccount: 'demo',
            defaultNumber: 1,
            defaultInterval: 3.5,
            operations: [
                { name: '后台发送', mode: 'item', method: 'POST', url: 'http://127.0.0.1/gm/gmquery.php', params: '{"action":"senditem","uid":"{{account}}","itemid":"{{item.value}}","itemnum":"{{number}}"}' },
                { name: '批量发送', mode: 'batch', method: 'POST', url: 'http://127.0.0.1/gm/batch.php', batchItem: '{"label":"{{item.name}}","id":"{{item.value}}","count":"{{number}}"}', batchEncoding: 'json', params: '{"uid":"{{account}}","items":"{{items}}"}' },
                { name: '清空邮箱', mode: 'command', method: 'POST', url: 'http://127.0.0.1/gm/ltdelete.php', params: '{"uid":"{{account}}","gmcode":"ltzy.vip"}' }
            ]
        }
    })
    assert.equal(created.key, 'demo_game')
    assert.equal(created.config.operations.length, 3)
    assert.equal(created.config.defaultInterval, 3.5)
    assert.deepEqual(created.config.operations[1].batchItem, { label: '{{item.name}}', id: '{{item.value}}', count: '{{number}}' })
    assert.equal(created.config.operations[1].batchEncoding, 'json')
    assert.equal(games.update('demo_game', { ...created, name: '修改后的游戏', enabled: false }).enabled, false)
    assert.equal(games.list({ enabledOnly: true }).some((game) => game.key === 'demo_game'), false)
    games.remove('demo_game')
    assert.throws(() => games.get('demo_game'), { status: 404 })

    const reopened = new GamesRepository(db)
    assert.equal(reopened.list().some((game) => game.key === 'demo_game'), false)
})
