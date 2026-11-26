export type OperationMode = 'item' | 'batch' | 'command'

export interface GameOperation {
    name: string
    mode: OperationMode
    url: string
    method?: 'GET' | 'POST'
    batchLimit?: number
    batchItem?: Record<string, unknown> | string
    batchEncoding?: 'json' | 'string'
    params: Record<string, unknown> | string
    session?: { resolveUrl: string }
}

export interface GameConfig {
    defaultAccount: string
    defaultNumber: number
    defaultInterval: number
    operations: GameOperation[]
}

export interface GameRecord {
    key: string
    name: string
    enabled: boolean
    sortOrder: number
    config: GameConfig
}

interface BatchItem {
    item: ItemsTypeSingle
    number: number
}

const omitted = Symbol('omitted')
const templateValue = (value: unknown, context: Record<string, unknown>): unknown => {
    if (Array.isArray(value)) return value.map((entry) => templateValue(entry, context)).filter((entry) => entry !== omitted)
    if (value && typeof value === 'object') {
        const rule = value as { $when?: { field?: string; equals?: unknown; notEquals?: unknown }; $value?: unknown }
        if (rule.$when && '$value' in rule) {
            const actual = context[String(rule.$when.field || '')]
            if ('equals' in rule.$when && actual !== rule.$when.equals) return omitted
            if ('notEquals' in rule.$when && actual === rule.$when.notEquals) return omitted
            return templateValue(rule.$value, context)
        }
        return Object.fromEntries(Object.entries(value).flatMap(([key, entry]) => {
            const rendered = templateValue(entry, context)
            return rendered === omitted ? [] : [[key, rendered]]
        }))
    }
    if (typeof value !== 'string') return value
    const exact = value.match(/^\{\{([^}]+)\}\}$/)
    if (exact) return context[exact[1]] ?? ''
    return value.replace(/\{\{([^}]+)\}\}/g, (_, key) => String(context[key] ?? ''))
}

export function buildGameOptions(game: GameRecord) {
    const operations = game.config.operations.map((operation) => {
        const params = typeof operation.params === 'string' ? JSON.parse(operation.params) : operation.params
        const batchItem = typeof operation.batchItem === 'string'
            ? JSON.parse(operation.batchItem)
            : operation.batchItem || { id: '{{item.value}}', num: '{{number}}' }
        const renderBatchItems = (items: BatchItem[]) => {
            const rendered = items.map(({ item, number }) => templateValue(batchItem, {
                number: Number(number),
                'item.value': item.value,
                'item.name': item.name,
                'item.action': item.action
            }))
            return operation.batchEncoding === 'json' ? rendered : JSON.stringify(rendered)
        }
        const render = (account: string, item?: ItemsTypeSingle, number?: number, items?: BatchItem[]) => {
            const selectedItems = items || (item ? [{ item, number: Number(number || 1) }] : [])
            return templateValue(params, {
                account,
                number: Number(number || 1),
                'item.value': item?.value ?? '',
                'item.name': item?.name ?? '',
                'item.action': item?.action ?? '',
                items: renderBatchItems(selectedItems)
            })
        }
        return {
            NAME: operation.name,
            TYPE: operation.method || 'POST',
            URL: operation.url,
            MODE: operation.mode,
            REQUIRES_ITEMS: operation.mode !== 'command',
            MAX_ITEM_COUNT: operation.batchLimit || 1,
            GETDATA: operation.mode === 'command'
                ? (account: string) => render(account)
                : (item: ItemsTypeSingle, account: string, number: number) => render(account, item, number),
            GETDATA_BATCH: operation.mode === 'batch'
                ? (items: BatchItem[], account: string) => render(account, items[0]?.item, items[0]?.number, items)
                : undefined
        }
    })
    return {
        ORIGIN_GOODS: [],
        ORIGIN_ACCOUNT: game.config.defaultAccount,
        ORIGIN_NUMBER: String(game.config.defaultNumber || 1),
        ORIGIN_INTERVAL: Number(game.config.defaultInterval ?? 2.5),
        OPERATION: operations
    }
}
