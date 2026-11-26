import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { openDatabase } from './admin/db.js'
import { GamesRepository } from './games.js'
import { ItemsRepository, parseItemCatalog } from './items.js'

const createRepository = async (context) => {
    const itemsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'game-req-items-'))
    const file = path.join(itemsDir, 'items.db')
    const db = openDatabase(file)
    context.after(async () => {
        db.close()
        await fs.rm(itemsDir, { recursive: true, force: true })
    })
    await fs.writeFile(
        path.join(itemsDir, 'demo.txt'),
        JSON.stringify([
            { value: '1', name: '元宝', action: 'mail' },
            { value: '2', name: '高级元宝', action: 'mail' },
            { value: '3', name: '铜钱', action: 'mail' },
            { value: '4', name: '绑定元宝', action: 'mail' }
        ])
    )
    const games = new GamesRepository(db)
    games.create({
        key: 'demo',
        name: '测试游戏',
        config: {
            defaultAccount: '',
            defaultNumber: 1,
            operations: [
                {
                    name: '后台发送',
                    mode: 'batch',
                    method: 'POST',
                    url: 'http://127.0.0.1/example',
                    batchLimit: 5,
                    params: { uid: '{{account}}', items: '{{items}}' }
                }
            ]
        }
    })
    const repository = new ItemsRepository(db)
    await repository.seed(itemsDir)
    return { repository, itemsDir, file }
}

test('query returns only the requested page', async (context) => {
    const { repository } = await createRepository(context)

    const result = await repository.query('demo', { page: 2, pageSize: 2 })

    assert.deepEqual(result.list, [
        { value: '3', name: '铜钱', action: 'mail', _position: 2 },
        { value: '4', name: '绑定元宝', action: 'mail', _position: 3 }
    ])
    assert.equal(result.total, 4)
    assert.equal(result.page, 2)
})

test('query filters on the server before pagination', async (context) => {
    const { repository } = await createRepository(context)

    const result = await repository.query('demo', { keyword: '元宝', page: 1, pageSize: 2 })

    assert.deepEqual(result.list, [
        { value: '1', name: '元宝', action: 'mail', _position: 0 },
        { value: '2', name: '高级元宝', action: 'mail', _position: 1 }
    ])
    assert.equal(result.total, 3)
})

test('locate finds the next match in original item order', async (context) => {
    const { repository } = await createRepository(context)

    const first = await repository.locate('demo', { keyword: '元宝', after: -1, pageSize: 2 })
    const second = await repository.locate('demo', { keyword: '元宝', after: first.index, pageSize: 2 })

    assert.equal(first.index, 0)
    assert.equal(first.page, 1)
    assert.equal(second.index, 1)
    assert.equal(second.page, 1)
})

test('imports replace the current catalog and preserve row order and original types', async (context) => {
    const { repository, file, itemsDir } = await createRepository(context)
    const rows = [
        { value: 1, name: '铜钱', action: 'mail', extra: { rank: 2 } },
        { value: '1', name: '铜钱', action: 'mail2' },
        { value: '4', name: '元宝', action: 'sendmoney' },
        { value: '#legacy note', name: '', action: 'mail' }
    ]
    const catalog = parseItemCatalog(JSON.stringify(rows))
    assert.equal(catalog.summary.duplicateValues, 1)
    assert.equal(catalog.summary.duplicateNames, 1)
    assert.equal(catalog.summary.unnamed, 1)
    const current = repository.replace('demo', 'new.txt', catalog)
    assert.deepEqual(repository.query('demo').list.map(({ _position, ...item }) => item), rows)
    assert.equal(repository.catalogs()[0].source, 'new.txt')
    assert.equal(repository.catalogs()[0].count, rows.length)
    const reopenedDb = openDatabase(file)
    try {
        const reopened = new ItemsRepository(reopenedDb)
        await reopened.seed(itemsDir)
        assert.equal(reopened.active('demo'), current)
        assert.deepEqual(reopened.query('demo').list.map(({ _position, ...item }) => item), rows)
    } finally {
        reopenedDb.close()
    }
})

test('pasted JSON strings and object paths can be mapped into catalog rows', () => {
    const source = JSON.stringify(JSON.stringify({
        data: [
            { xxx: '元宝', yyy: 1001 },
            { xxx: '铜钱', yyy: '1002' }
        ]
    }))
    const catalog = parseItemCatalog(source, {
        listPath: 'data',
        namePath: 'xxx',
        valuePath: 'yyy',
        actionMode: 'fixed',
        actionValue: 'mail'
    })
    assert.equal(catalog.error, undefined)
    assert.deepEqual(catalog.rows, [
        { name: '元宝', value: 1001, action: 'mail' },
        { name: '铜钱', value: '1002', action: 'mail' }
    ])
    assert.equal(catalog.summary.invalid, 0)
})

test('mapped action can come from a nested field', () => {
    const catalog = parseItemCatalog(JSON.stringify([
        { label: '元宝', id: '1', meta: { action: 'sendmoney' } }
    ]), {
        namePath: 'label',
        valuePath: 'id',
        actionMode: 'field',
        actionPath: 'meta.action'
    })
    assert.deepEqual(catalog.rows, [{ name: '元宝', value: '1', action: 'sendmoney' }])
})

test('individual items can be added, edited and deleted', async (context) => {
    const { repository } = await createRepository(context)
    const position = repository.saveItem('demo', null, { value: '5', name: '新增物品', action: 'mail' })
    assert.equal(repository.query('demo', { keyword: '新增物品' }).list[0]._position, position)
    repository.saveItem('demo', position, { value: '5', name: '修改物品', action: 'mail2' })
    assert.equal(repository.query('demo', { keyword: '修改物品' }).list[0].action, 'mail2')
    repository.removeItem('demo', position)
    assert.equal(repository.query('demo', { keyword: '修改物品' }).total, 0)
})
