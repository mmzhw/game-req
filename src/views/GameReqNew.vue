<template>
    <div class="flex-column">
        <div class="flex-column">
            <div class="flex-line" v-for="(item, index) in baseForm" :key="'base-form' + index">
                <label>{{ item.label }}：</label>
                <el-input v-model="item.value" @input="(value:string) => LSSaveValue(item.key, value)" />
            </div>
            <div class="flex-line">
                <label>已选({{selectedItems.length}})：</label>
                <div style="line-height: 32px;max-height: 8vh;overflow: auto;">
                    <template v-if="selectedItems?.length">
                        <el-tag class="marginRightFive" v-for="(i, index) in selectedItems" :key="'selected-good' + index" closable @close="clearSingleItem(i)">{{ i.name }}</el-tag>
                    </template>
                    <span v-else>暂未选择</span>
                </div>
            </div>
            <div class="flex-line">
                <label>过滤：</label>
                <div>
                    <el-input v-model="keyWord" placeholder="过滤" @input="changeGoods" />
                </div>
            </div>
            <div class="flex-line">
                <label>物品：</label>
                <div>
                    <checkbox-pagination :data-list="goodsList" v-model:currentItem="selectedItems" :routeType="routeType" :pageSize="50" maxHeight="50vh" checkboxType="default" />
                </div>
            </div>
            <div style="display: flex; padding-bottom: 10px">
                <el-button type="primary" @click="getGoods($event, false)">直接发送</el-button>
                <el-button type="primary" @click="getGoods($event, true)">后台转发</el-button>
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

const props = withDefaults(defineProps<PropsRadioPagination>(), {
    routeType: ''
})

let goodsList: any = ref([])
let selectedItems: any = ref([])
let keyWord: any = ref('')
let baseForm: any = reactive([
    { label: '账号 | 角色', key: 'account', value: '' },
    { label: '数量', key: 'number', value: '1' }
])

let originGoods: any = []
let originReqUrl: any = ''
let originReqMethod: any = ''
let originReqFormData: any = null

const initOptions = () => {
    let gameOptions = getGameOptions(props.routeType)
    goodsList.value = originGoods = gameOptions?.ORIGIN_GOODS || []
    originReqUrl = gameOptions?.ORIGIN_REQ_URL || ''
    originReqMethod = gameOptions?.ORIGIN_REQ_METHOD || ''
    originReqFormData = gameOptions?.ORIGIN_REQ_FORM_DATA || (()=>{})

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
        goodsList.value = _.cloneDeep(originGoods).filter((i: ItemsSingle) => {
            return value && i.name.includes(value)
        })
    } else {
        goodsList.value = _.cloneDeep(originGoods)
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
            await getTransmitGood(selectedItems.value[i])
        } else {
            await getGood(selectedItems.value[i])
        }
        await new Promise((resolve) => setTimeout(resolve, 1000))
    }
}
const getGood = async (i: ItemsSingle) => {
    let realTimeAccount = baseForm.find((j: any) => j.key === 'account')?.value
    let realTimeNumber = baseForm.find((j: any) => j.key === 'number')?.value
    let formDataJson = originReqFormData(i, realTimeAccount, realTimeNumber)

    let formData = new FormData()
    Object.keys(formDataJson).forEach((key) => {
        formData.append(key, formDataJson[key])
    })
    let response = await axios.post(originReqUrl, formData, {
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        }
    })
    if (response) {
        emit('addLogs', response.data?.data || response.data)
    }
}
const getTransmitGood = async (i: ItemsSingle) => {
    let realTimeAccount = baseForm.find((j: any) => j.key === 'account')?.value
    let realTimeNumber = baseForm.find((j: any) => j.key === 'number')?.value
    let formData = originReqFormData(i, realTimeAccount, realTimeNumber)
    await axios({
        method: 'post',
        url: reqPre + '/api',
        data: {
            reqData: [
                {
                    name: i.name,
                    formData,
                    realReqUrl: originReqUrl,
                    realReqMethod: originReqMethod
                }
            ]
        }
    })
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
:deep {
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
    :deep {
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
