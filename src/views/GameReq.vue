<template>
    <div class="flex-column">
        <div class="flex-column">
            <div class="flex-line" v-if="routeType === 'mjdx'">
                <label>自用：</label>
                <div style="line-height: 32px; max-height: 8vh; overflow: auto">清路尘,倚香雪,4555786550362769000,4555786550362768745</div>
            </div>
            <div class="flex-line" v-for="(item, index) in baseForm" :key="'base-form' + index">
                <label>{{ item.label }}：</label>
                <el-input v-model="item.value" @input="(value:string) => LSSaveValue(item.key, value)" />
            </div>
            <div class="flex-line">
                <label>已选({{ selectedItems.length }})：</label>
                <div>
                    <template v-if="selectedItems?.length">
                        <div class="selected-list">
                            <div class="selected-item" v-for="(i, index) in selectedItems" :key="'selected-good' + index">
                                <el-tag class="selected-item-tag" closable @close="clearSingleItem(i)">{{ i.name }}（{{ i.value }}）</el-tag>
                                <el-input-number class="selected-item-number" v-model="itemNumbers[i.value]" :min="1" :step="1" :precision="0" size="small" controls-position="right" :title="'设置 ' + i.name + '（' + i.value + '）的发送数量'" />
                            </div>
                        </div>
                    </template>
                    <span v-else class="selected-empty">暂未选择</span>
                </div>
            </div>
            <div class="flex-line">
                <label>过滤：</label>
                <div style="display: flex">
                    <el-input v-model="keyWord" placeholder="过滤" @input="changeGoods" />
                    <el-input style="margin-left: 10px" v-model="keyWordLocation" placeholder="定位" @input="locationGoods()" />
                    <el-button style="width: 100px; margin-left: 10px" @click="locationGoods()">下一个</el-button>
                </div>
            </div>
            <div class="flex-line" v-if="!isMobile">
                <label>物品：</label>
                <div>
                    <checkbox-pagination ref="checkboxPaginationRef" :data-list="goodsList" v-model:currentItem="selectedItems" :routeType="routeType" :pageSize="pageSize" maxHeight="50vh" checkboxType="default" />
                </div>
            </div>
            <checkbox-pagination v-if="isMobile" ref="checkboxPaginationRef" :data-list="goodsList" v-model:currentItem="selectedItems" :routeType="routeType" :pageSize="pageSize" maxHeight="50vh" checkboxType="default" />
            <div style="display: flex; align-items: center; gap: 10px">
                <el-input style="padding-bottom: 10px" v-model="intervalTime" placeholder="间隔发送"></el-input>
                <el-input style="padding-bottom: 10px" v-model="repeatTime" placeholder="重复次数"></el-input>
            </div>
            <div style="display: flex; padding-bottom: 10px">
                <!--                <el-button type="primary" @click="getGoods($event, false)">直接发送</el-button>-->
                <!--                <el-button type="primary" @click="getGoods($event, true)">后台转发</el-button>-->
                <!--                <el-button v-if="GAME_OPTIONS?.ORIGIN_REQ_DEL_FORM_DATA" type="primary" @click="delGoods">删除物品</el-button>-->
                <template v-for="(operation, oIndex) in GAME_OPTIONS.OPERATION" :key="oIndex">
                    <el-button type="primary" @click="operationSend(operation)">{{ operation.NAME }}</el-button>
                </template>
                <el-button type="primary" @click="selectedItems = []">清空选择</el-button>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { defineEmits, reactive, ref, watch } from 'vue'
import CheckboxPagination from '../components/Checkbox-Pagination.vue'
import axios from 'axios'
import getGameOptions from '@/constant/options'
import _ from 'lodash'

const emit = defineEmits(['addLogs'])

const reqPre = import.meta.env.DEV ? 'http://localhost:3000' : ''

interface PropsRadioPagination {
    routeType: string
}

interface CheckboxPaginationInstance {
    updateSize(page: number): void
}

interface SelectedItemNumber {
    item: ItemsTypeSingle
    number: number
}

const props = withDefaults(defineProps<PropsRadioPagination>(), {
    routeType: ''
})

let intervalTime = ref('')
let repeatTime = ref('')
let pageSize = ref(50)
let goodsList: any = ref([])
let selectedItems: any = ref([])
const itemNumbers = reactive<Record<string, number>>({})
let keyWord: any = ref('')
let keyWordLocation: any = ref('')
let keyWordLocationCurrent: any = ref('')
let keyWordLocationMatchIndex: any = ref('')
let baseForm: any = reactive([
    { label: '角色', key: 'account', value: '' },
    { label: '默认数量', key: 'number', value: '1' }
])
const checkboxPaginationRef = ref<CheckboxPaginationInstance | null>(null)

let originGoods: any = []

const GAME_OPTIONS = ref<any>({})

const isMobile = ref(/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent))

const sleep = async (ms: any) => {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

const initOptions = async () => {
    let gameOptions = await getGameOptions(props.routeType)
    GAME_OPTIONS.value = _.cloneDeep(gameOptions)

    goodsList.value = originGoods = gameOptions?.ORIGIN_GOODS || []

    selectedItems.value = []
    keyWord.value = ''

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
const changeGoods = (value: string) => {
    if (value) {
        keyWordLocation.value = ''
        goodsList.value = _.cloneDeep(originGoods).filter((i: ItemsSingle) => {
            return value && i.name.includes(value)
        })
    } else {
        goodsList.value = _.cloneDeep(originGoods)
    }
}
const locationGoods = () => {
    let value = keyWordLocation.value
    if (value) {
        keyWord.value = ''

        const indices: any = []
        _.cloneDeep(originGoods).forEach((i: ItemsSingle, index: number) => {
            if (i.name.includes(value)) {
                indices.push(index)
            }
        })

        if (value === keyWordLocationCurrent.value) {
            keyWordLocationMatchIndex.value += 1
        } else {
            keyWordLocationMatchIndex.value = 0
            keyWordLocationCurrent.value = value
        }

        let matchIndex = indices[keyWordLocationMatchIndex.value]

        if (matchIndex > 0 && checkboxPaginationRef.value) {
            checkboxPaginationRef.value?.updateSize(Math.floor(matchIndex / pageSize.value) + 1)
        }
    }
}
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

    let reqData: any = []
    realTimeAccount.forEach((account: string) => {
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
                            realReqUrl: operation.URL,
                            realReqMethod: operation.TYPE
                        })
                    })
                })
            } else {
                selectedItemNumbers.forEach(({ item, number }: SelectedItemNumber) => {
                    reqData.push({
                        name: item.name,
                        account: account,
                        formData: operation.GETDATA(item, account, number),
                        realReqUrl: operation.URL,
                        realReqMethod: operation.TYPE
                    })
                })
            }
        } else {
            // 非物品的操作
            reqData.push({
                name: operation.NAME,
                account: account,
                formData: operation.GETDATA(account),
                realReqUrl: operation.URL,
                realReqMethod: operation.TYPE
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
        const selectedValues = new Set(items.map((item) => item.value))
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

<style scoped src="../assets/game-req.scss"></style>
<style scoped lang="scss">
:deep() {
    .el-radio-button {
        margin-right: 5px;

        .el-radio-button__inner {
            box-shadow: none !important;
            border: 1px solid #dcdfe6;
            border-radius: 4px !important;
            margin-bottom: 5px;
        }
    }
}

.gameTypeWrap {
    :deep() {
        .el-radio-button__inner {
            margin-bottom: 0;
        }

        .el-radio-button {
            margin-bottom: 5px;
        }
    }
}

.marginRightFive {
    margin-right: 5px;
}

.selected-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    max-height: 20vh;
    overflow: auto;
    line-height: 1;
}

.selected-item {
    display: flex;
    align-items: center;
    gap: 4px;
}

.selected-item-number {
    width: 100px;
}

.selected-empty {
    line-height: 32px;
}
</style>
