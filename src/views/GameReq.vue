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
                <div style="line-height: 32px; max-height: 8vh; overflow: auto">
                    <template v-if="selectedItems?.length">
                        <el-tag class="marginRightFive" v-for="(i, index) in selectedItems" :key="'selected-good' + index" closable @close="clearSingleItem(i)">{{ i.name }}</el-tag>
                    </template>
                    <span v-else>暂未选择</span>
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
            <!--            <div class="flex-line" v-if="!isMobile">-->
            <!--                <label>定位：</label>-->
            <!--                <div style="display: flex">-->
            <!--                    <el-input v-model="keyWordLocation" placeholder="定位" @input="locationGoods()"/>-->
            <!--                    <el-button style="width: 100px;margin-left: 10px" @click="locationGoods()">下一个</el-button>-->
            <!--                </div>-->
            <!--            </div>-->
            <div class="flex-line" v-if="!isMobile">
                <label>物品：</label>
                <div>
                    <checkbox-pagination ref="checkboxPaginationRef" :data-list="goodsList" v-model:currentItem="selectedItems" :routeType="routeType" :pageSize="pageSize" maxHeight="50vh" checkboxType="default" />
                </div>
            </div>
            <checkbox-pagination v-if="isMobile" ref="checkboxPaginationRef" :data-list="goodsList" v-model:currentItem="selectedItems" :routeType="routeType" :pageSize="pageSize" maxHeight="50vh" checkboxType="default" />
            <div style="display: flex; padding-bottom: 10px">
                <el-button type="primary" @click="getGoods($event, false)">直接发送</el-button>
                <el-button type="primary" @click="getGoods($event, true)">后台转发</el-button>
                <el-button v-if="GAME_OPTIONS?.ORIGIN_REQ_DEL_FORM_DATA" type="primary" @click="delGoods">删除物品</el-button>
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

const props = withDefaults(defineProps<PropsRadioPagination>(), {
    routeType: ''
})

let pageSize = ref(50)
let goodsList: any = ref([])
let selectedItems: any = ref([])
let keyWord: any = ref('')
let keyWordLocation: any = ref('')
let keyWordLocationCurrent: any = ref('')
let keyWordLocationMatchIndex: any = ref('')
let baseForm: any = reactive([
    { label: '角色', key: 'account', value: '' },
    { label: '数量', key: 'number', value: '1' }
])
const checkboxPaginationRef = ref<CheckboxPaginationInstance | null>(null)

let originGoods: any = []

const GAME_OPTIONS = ref<any>({})

const isMobile = ref(/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent))

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
const getGoods = async ($event: any, transmit: boolean) => {
    for (let i = 0; i < selectedItems.value.length; i++) {
        if (transmit) {
            await getGoodFromServer(selectedItems.value[i]) //后台发送
        } else {
            await getGoodFromLocal(selectedItems.value[i]) //前台发送
        }
    }
}
const delGoods = async () => {
    for (let i = 0; i < selectedItems.value.length; i++) {
        await delGoodFromServer(selectedItems.value[i]) //后台发送
    }
}
const getGoodFromLocal = async (i: ItemsSingle) => {
    let realTimeAccount = baseForm.find((j: any) => j.key === 'account')?.value
    realTimeAccount = realTimeAccount.split(',')
    for (let z = 0; z < realTimeAccount.length; z++) {
        let realTimeNumber = baseForm.find((j: any) => j.key === 'number')?.value
        let formDataJson = GAME_OPTIONS.value.ORIGIN_REQ_FORM_DATA(i, realTimeAccount[z], realTimeNumber)

        let formData = new FormData()
        Object.keys(formDataJson).forEach((key) => {
            formData.append(key, formDataJson[key])
        })
        try {
            let response = await axios.post(GAME_OPTIONS.value.ORIGIN_REQ_URL, formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                }
            })
            emit('addLogs', `${realTimeAccount[z]} ${i.name} ${response.data?.data || response.data}`)
        } catch (err) {
            emit('addLogs', `${realTimeAccount[z]} ${i.name} 发送失败`)
        }
    }
}
const getGoodFromServer = async (i: ItemsTypeSingle) => {
    let realTimeAccount = baseForm.find((j: any) => j.key === 'account')?.value
    realTimeAccount = realTimeAccount.split(',')
    for (let z = 0; z < realTimeAccount.length; z++) {
        let realTimeNumber = baseForm.find((j: any) => j.key === 'number')?.value
        let formData = GAME_OPTIONS.value.ORIGIN_REQ_FORM_DATA(i, realTimeAccount[z], realTimeNumber)

        if (props.routeType === 'wl' && i.type === 'charge2') {
            delete formData.item
            formData.num = i.value
        }

        await axios({
            method: 'post',
            url: reqPre + '/api',
            data: {
                reqData: [
                    {
                        name: i.name,
                        account: realTimeAccount[z],
                        formData,
                        realReqUrl: GAME_OPTIONS.value.ORIGIN_REQ_URL,
                        realReqMethod: GAME_OPTIONS.value.ORIGIN_REQ_METHOD
                    }
                ]
            }
        })
    }
}
const delGoodFromServer = async (i: ItemsSingle) => {
    let realTimeAccount = baseForm.find((j: any) => j.key === 'account')?.value
    realTimeAccount = realTimeAccount.split(',')
    for (let z = 0; z < realTimeAccount.length; z++) {
        let realTimeNumber = baseForm.find((j: any) => j.key === 'number')?.value
        let formData = GAME_OPTIONS.value.ORIGIN_REQ_DEL_FORM_DATA(i, realTimeAccount[z], realTimeNumber)

        if (props.routeType === 'mjdx'){
            formData.item = formData.item.replace('additem', 'subitem')
        }

        await axios({
            method: 'post',
            url: reqPre + '/api',
            data: {
                reqData: [
                    {
                        name: i.name,
                        account: realTimeAccount[z],
                        formData,
                        realReqUrl: GAME_OPTIONS.value.ORIGIN_REQ_URL,
                        realReqMethod: GAME_OPTIONS.value.ORIGIN_REQ_METHOD
                    }
                ]
            }
        })
    }
}

watch(
    () => props.routeType,
    () => {
        initOptions()
    },
    { immediate: true }
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
</style>
