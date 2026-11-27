<template>
    <section class="send-panel">
        <div v-if="routeType === 'mjdx'" class="form-row">
            <label>自用：</label>
            <div class="form-content preset-content">清路尘,倚香雪,4555786550362769000,4555786550362768745</div>
        </div>
        <div class="form-row" v-for="(item, index) in baseForm" :key="'base-form' + index">
            <label>{{ item.label }}：</label>
            <div class="form-content base-field">
                <el-input v-model="item.value" @input="(value:string) => LSSaveValue(item.key, value)" />
            </div>
        </div>
        <div class="form-row align-start">
            <label>已选({{ selectedItems.length }})：</label>
            <div class="form-content">
                <el-scrollbar v-if="selectedItems?.length" max-height="180px" view-class="selected-list">
                    <div class="selected-item" v-for="(i, index) in selectedItems" :key="'selected-good' + index">
                        <el-tag class="selected-item-tag" closable @close="clearSingleItem(i)">{{ i.name }}（{{ i.value }}）</el-tag>
                        <el-input-number class="selected-item-number" v-model="itemNumbers[i.value]" :min="1" :step="1" :precision="0" size="small" controls-position="right" :title="'设置 ' + i.name + '（' + i.value + '）的发送数量'" />
                    </div>
                </el-scrollbar>
                <span v-else class="selected-empty">暂未选择</span>
            </div>
        </div>
        <div class="form-row">
            <label>查找物品：</label>
            <div class="form-content filter-grid">
                <el-input v-model="keyWord" clearable placeholder="按名称过滤" @input="changeGoods" />
                <el-input v-model="keyWordLocation" clearable placeholder="定位物品" @input="locationGoodsOnInput" />
                <el-button @click="locationGoods()">下一个</el-button>
            </div>
        </div>
        <div class="form-row align-start items-row">
            <label>物品列表：</label>
            <div class="form-content">
                <checkbox-pagination
                    ref="checkboxPaginationRef"
                    :data-list="goodsList"
                    :highlight-keyword="keyWord"
                    v-model:currentItem="selectedItems"
                    :routeType="routeType"
                    :pageSize="pageSize"
                    :remote-total="goodsTotal"
                    remote
                    maxHeight="50vh"
                    checkboxType="default"
                    @page-change="loadGoods"
                    @size-change="changePageSize"
                />
            </div>
        </div>
        <div class="form-row">
            <label>发送间隔：</label>
            <div class="form-content compact-control">
                <el-input-number v-model="intervalTime" :min="0" :max="60" :step="0.5" :precision="1" controls-position="right" />
                <span class="unit">秒</span>
            </div>
        </div>
        <div class="form-row">
            <label>重复次数：</label>
            <div class="form-content compact-control">
                <el-input-number v-model="repeatTime" :min="1" :max="1000" :step="1" :precision="0" controls-position="right" />
            </div>
        </div>
        <div class="form-row align-start">
            <label>发送操作：</label>
            <div class="form-content action-buttons">
                <el-button
                    v-for="(operation, oIndex) in GAME_OPTIONS.OPERATION"
                    :key="oIndex"
                    type="primary"
                    :disabled="operation.REQUIRES_ITEMS && !selectedItems.length"
                    @click="operationSend(operation)"
                >{{ operation.NAME }}</el-button>
                <el-button @click="selectedItems = []">清空选择</el-button>
            </div>
        </div>
    </section>
</template>

<script lang="ts" setup>
import { defineEmits, reactive, ref, watch } from 'vue'
import CheckboxPagination from '../components/Checkbox-Pagination.vue'
import axios from 'axios'
import { adminRequest } from '@/utils/admin-api'
import { buildGameOptions, type GameRecord } from '@/utils/game-templates'
import _ from 'lodash'

const emit = defineEmits(['addLogs'])

const reqPre = ''

interface PropsRadioPagination {
    routeType: string
}

interface CheckboxPaginationInstance {
    updateSize(page: number): void
    getPageSize(): number
}

interface SelectedItemNumber {
    item: ItemsTypeSingle
    number: number
}

const props = withDefaults(defineProps<PropsRadioPagination>(), {
    routeType: ''
})

let intervalTime = ref(2.5)
let repeatTime = ref(1)
let pageSize = ref(50)
let goodsList: any = ref([])
let goodsTotal = ref(0)
let selectedItems: any = ref([])
const itemNumbers = reactive<Record<string, number>>({})
let keyWord: any = ref('')
let keyWordLocation: any = ref('')
let keyWordLocationCurrent: any = ref('')
let keyWordLocationAfter = ref(-1)
let baseForm: any = reactive([
    { label: '角色', key: 'account', value: '' },
    { label: '默认数量', key: 'number', value: '1' }
])
const checkboxPaginationRef = ref<CheckboxPaginationInstance | null>(null)

let goodsRequestId = 0
const itemCache = new Map<string, ItemsTypeSingle>()

const GAME_OPTIONS = ref<any>({})

const initOptions = async () => {
    const game = await adminRequest<GameRecord>(`/api/games/${encodeURIComponent(props.routeType)}`)
    let gameOptions = buildGameOptions(game)
    GAME_OPTIONS.value = _.cloneDeep(gameOptions)

    itemCache.clear()
    goodsList.value = []
    goodsTotal.value = 0
    selectedItems.value = []
    keyWord.value = ''
    keyWordLocation.value = ''
    keyWordLocationCurrent.value = ''
    keyWordLocationAfter.value = -1
    intervalTime.value = gameOptions.ORIGIN_INTERVAL
    repeatTime.value = 1
    await loadGoods(1)

    baseForm.forEach((item: any) => {
        if (item.key === 'account') {
            item.value = window.localStorage.getItem(props.routeType + 'account') || gameOptions?.ORIGIN_ACCOUNT
        } else if (item.key === 'number') {
            item.value = window.localStorage.getItem(props.routeType + 'number') || gameOptions?.ORIGIN_NUMBER
        }
    })
}
const LSSaveValue = (key: string, value: any) => {
    window.localStorage.setItem(props.routeType + key, String(value))
}

const getCachedItems = (items: ItemsTypeSingle[]) => {
    return items.map((item) => {
        const key = String(item.value)
        const cachedItem = itemCache.get(key)
        if (cachedItem) {
            Object.assign(cachedItem, item)
            return cachedItem
        }
        itemCache.set(key, item)
        return item
    })
}

const loadGoods = async (page = 1, keyword = keyWord.value) => {
    const requestId = ++goodsRequestId
    const response = await axios.get(`${reqPre}/api/items/${props.routeType}`, {
        params: {
            keyword,
            page,
            pageSize: pageSize.value
        }
    })
    if (requestId !== goodsRequestId) {
        return
    }
    goodsList.value = getCachedItems(response.data.list || [])
    goodsTotal.value = response.data.total || 0
    checkboxPaginationRef.value?.updateSize(response.data.page || 1)
}

const changePageSize = async (size: number) => {
    pageSize.value = size
    await loadGoods(1)
}

const changeGoods = _.debounce(async () => {
    keyWordLocation.value = ''
    keyWordLocationCurrent.value = ''
    keyWordLocationAfter.value = -1
    await loadGoods(1)
}, 250)

const locationGoods = async () => {
    const value = String(keyWordLocation.value || '').trim()
    if (!value) {
        return
    }
    keyWord.value = ''

    if (value !== keyWordLocationCurrent.value) {
        keyWordLocationCurrent.value = value
        keyWordLocationAfter.value = -1
    }

    const response = await axios.get(`${reqPre}/api/items/${props.routeType}/locate`, {
        params: {
            keyword: value,
            after: keyWordLocationAfter.value,
            pageSize: pageSize.value
        }
    })
    if (response.data.found) {
        keyWordLocationAfter.value = response.data.index
        await loadGoods(response.data.page, '')
    }
}

const locationGoodsOnInput = _.debounce(async () => {
    keyWordLocationCurrent.value = ''
    keyWordLocationAfter.value = -1
    await locationGoods()
}, 250)
const clearSingleItem = (i: ItemsSingle) => {
    selectedItems.value = selectedItems.value.filter((z: ItemsSingle) => {
        return z.value !== i.value
    })
}

const getDefaultNumber = () => {
    const value = Number(baseForm.find((item: any) => item.key === 'number')?.value)
    return Number.isFinite(value) && value > 0 ? value : 1
}

const getItemNumber = (item: ItemsTypeSingle) => {
    return itemNumbers[item.value] ?? getDefaultNumber()
}

const getBatchName = (items: SelectedItemNumber[]) => {
    const firstName = items[0]?.item.name || '物品'
    return items.length > 1 ? `${firstName} 等${items.length}件` : firstName
}

const operationSend = async (operation: any) => {
    const realTimeAccount = String(baseForm.find((j: any) => j.key === 'account')?.value || '')
        .split(',')
        .map((account: string) => account.trim())
        .filter(Boolean)
    const selectedItemNumbers: SelectedItemNumber[] = selectedItems.value.map((item: ItemsTypeSingle) => ({
        item,
        number: getItemNumber(item)
    }))
    const maxItemCount = Number(operation.MAX_ITEM_COUNT) || 0
    const requestMeta = {
        game: props.routeType,
        realReqUrl: operation.URL,
        realReqMethod: operation.TYPE,
        headers: operation.HEADERS,
        session: operation.SESSION
    }

    let reqData: any = []
    realTimeAccount.forEach((account: string) => {
        if (operation.MODE === 'command') {
            reqData.push({
                name: operation.NAME,
                account,
                formData: operation.GETDATA(account),
                ...requestMeta
            })
            return
        }
        if (selectedItemNumbers.length) {
            if (operation.GETDATA_BATCH && maxItemCount > 0) {
                const actionGroups = _.groupBy(selectedItemNumbers, ({ item }) => item.action || '')
                const groups = Object.values(actionGroups) as SelectedItemNumber[][]
                groups.forEach((group) => {
                    _.chunk(group, maxItemCount).forEach((items: SelectedItemNumber[]) => {
                        reqData.push({
                            name: getBatchName(items),
                            account: account,
                            formData: operation.GETDATA_BATCH(items, account),
                            ...requestMeta
                        })
                    })
                })
            } else {
                selectedItemNumbers.forEach(({ item, number }: SelectedItemNumber) => {
                    reqData.push({
                        name: item.name,
                        account: account,
                        formData: operation.GETDATA(item, account, number),
                        ...requestMeta
                    })
                })
            }
        } else {
            // 非物品的操作
            reqData.push({
                name: operation.NAME,
                account: account,
                formData: operation.GETDATA(account),
                ...requestMeta
            })
        }
    })
    await axios({ method: 'post', url: reqPre + '/api', data: { reqData: reqData, repeatTime: repeatTime.value, intervalTime: intervalTime.value } })
}
// const getGoods = async (operation: any) => {
//     for (let i = 0; i < selectedItems.value.length; i++) {
//         await getGoodFromLocal(selectedItems.value[i]) //前台发送
//         if (intervalTime.value) {
//             await sleep(Number(intervalTime.value))
//         }
//     }
// }
// const getGoodFromLocal = async (i: ItemsSingle) => {
//     let realTimeAccount = baseForm.find((j: any) => j.key === 'account')?.value
//     realTimeAccount = realTimeAccount.split(',')
//     for (let z = 0; z < realTimeAccount.length; z++) {
//         let realTimeNumber = baseForm.find((j: any) => j.key === 'number')?.value
//         let formDataJson = GAME_OPTIONS.value.ORIGIN_REQ_FORM_DATA(i, realTimeAccount[z], realTimeNumber)
//
//         let formData = new FormData()
//         Object.keys(formDataJson).forEach((key) => {
//             formData.append(key, formDataJson[key])
//         })
//         try {
//             let response = await axios.post(GAME_OPTIONS.value.ORIGIN_REQ_URL, formData, {
//                 headers: {
//                     'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
//                 }
//             })
//             emit('addLogs', `${realTimeAccount[z]} ${i.name} ${response.data?.data || response.data}`)
//         } catch (err) {
//             emit('addLogs', `${realTimeAccount[z]} ${i.name} 发送失败`)
//         }
//         if (intervalTime.value) {
//             await sleep(Number(intervalTime.value))
//         }
//     }
// }

watch(
    () => props.routeType,
    () => {
        initOptions()
    },
    { immediate: true }
)

watch(
    selectedItems,
    (items: ItemsTypeSingle[]) => {
        const defaultNumber = getDefaultNumber()
        const selectedValues = new Set(items.map((item) => String(item.value)))
        items.forEach((item) => {
            if (itemNumbers[item.value] === undefined) {
                itemNumbers[item.value] = defaultNumber
            }
        })
        Object.keys(itemNumbers).forEach((value) => {
            if (!selectedValues.has(value)) {
                delete itemNumbers[value]
            }
        })
    },
    { deep: true, immediate: true }
)
</script>

<style scoped lang="scss">
.send-panel {
    display: grid;
    gap: 14px;
    min-width: 0;
    padding: 20px;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius);
    background: var(--ui-surface);
    box-shadow: var(--ui-shadow);
}

.form-row {
    display: grid;
    grid-template-columns: 100px minmax(0, 1fr);
    align-items: center;
    gap: 12px;

    > label {
        color: var(--ui-muted);
        font-size: 14px;
        font-weight: 600;
        line-height: 1.4;
    }

    &.align-start {
        align-items: start;

        > label { padding-block: 8px; }
    }

    &:last-child {
        padding-top: 14px;
        border-top: 1px solid var(--ui-border);
    }
}

.form-content {
    min-width: 0;
}

.preset-content {
    padding: 8px 12px;
    border-radius: 6px;
    background: var(--ui-bg);
    color: var(--ui-muted);
    font-size: 13px;
    overflow-wrap: anywhere;
}

.filter-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
    align-items: center;
    gap: 8px;

    :deep(.el-button) { min-height: var(--el-component-size); }
}

.compact-control {
    display: flex;
    align-items: center;
    gap: 8px;

    :deep(.el-input-number) {
        width: 156px;
        max-width: 100%;
    }
}

.unit,
.selected-empty {
    color: var(--ui-muted);
}

.selected-empty {
    display: flex;
    align-items: center;
    min-height: 36px;
    padding-inline: 12px;
    border: 1px dashed var(--ui-border);
    border-radius: 6px;
    background: var(--ui-bg);
    font-size: 13px;
}

.action-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    :deep(.el-button) {
        height: auto;
        min-height: 36px;
        max-width: 100%;
        margin: 0;
        line-height: 1.4;
        white-space: normal;
        overflow-wrap: anywhere;
    }
}

:deep(.selected-list) {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));
    gap: 8px;
    padding: 2px 8px 2px 2px;
}

.selected-item {
    display: flex;
    align-items: stretch;
    gap: 6px;
    min-width: 0;
}

.selected-item-tag {
    --el-tag-bg-color: var(--ui-accent-soft);
    --el-tag-border-color: var(--ui-border);
    --el-tag-text-color: var(--ui-accent);

    flex: 1;
    justify-content: space-between;
    min-width: 0;
    height: auto;
    min-height: 32px;
    padding-block: 4px;
    line-height: 1.4;
    white-space: normal;
    overflow-wrap: anywhere;

    :deep(.el-tag__content) { min-width: 0; }
    :deep(.el-tag__close) { flex-shrink: 0; }
}

.selected-item-number {
    flex: 0 0 92px;
    width: 92px;
    align-self: center;
}

@media (width > 768px) {
    .form-row > label { text-align: end; }

    .base-field,
    .filter-grid,
    .selected-empty { max-width: 385px; }

    :deep(.selected-list) {
        display: flex;
        flex-wrap: wrap;
        padding-block-start: 0;
        padding-inline-start: 0;
    }

    .selected-item {
        width: min(100%, 320px);
    }

    .selected-item-tag,
    .selected-item-number :deep(.el-input__wrapper) {
        min-height: var(--el-component-size);
    }
}

.form-row:not(.items-row) :deep(.el-input-number.is-controls-right :is(.el-input-number__increase, .el-input-number__decrease)) {
    --el-input-number-controls-height: calc((var(--el-component-size) - 2px) / 2);
}

@media (max-width: 768px) {
    .send-panel { padding: 12px; }

    .form-row,
    .form-row.align-start {
        grid-template-columns: minmax(0, 1fr);
        gap: 6px;

        > label { padding: 0; }
    }

    .filter-grid {
        grid-template-columns: minmax(0, 1fr) auto;

        :deep(.el-input:first-child) { grid-column: 1 / -1; }
    }

    .form-content :deep(.el-input__wrapper),
    .filter-grid :deep(.el-button),
    .action-buttons :deep(.el-button) {
        min-height: 40px;
    }

    .selected-item-tag :deep(.el-tag__close) {
        width: 26px;
        height: 26px;
    }
}
</style>
