<template>
    <div class="flex-column">
        <div class="flex-column" v-show="hasPage">
            <div class="flex-line">
                <label>姓名：</label>
                <div>
                    <el-input v-model="nameWord" @input="changeName" />
                </div>
            </div>
            <div class="flex-line">
                <label>类型：</label>
                <div>
                    <el-select style="width: 100%" v-model="reqType" placeholder="Select" @change="changeReqType">
                        <el-option label="充值一" value="charge" />
                        <el-option label="充值二" value="charge2" />
                        <el-option label="邮件" value="mail" />
                    </el-select>
                </div>
            </div>
            <div class="flex-line">
                <label>数目：</label>
                <div>
                    <el-input v-model="itemNum" placeholder="数目" @change="changeItemNumber" />
                </div>
            </div>
            <div class="flex-line">
                <label>已选：</label>
                <div style="line-height: 32px">
                    <el-tag class="marginRightFive" v-for="(i, index) in selectedItems" :key="'yixuan' + index" closable @close="selectedItemsClearOne(i)">{{ i.name }}</el-tag>
                </div>
            </div>
            <div class="flex-line" v-if="reqType === 'mail'">
                <label>过滤：</label>
                <div>
                    <el-input v-model="keyWord" placeholder="过滤" @input="changeWupin" />
                </div>
            </div>
            <div class="flex-line" v-if="reqType === 'mail'">
                <label>过滤：</label>
                <div>
                    <checkbox-pagination :data-list="itemsList" v-model:currentItem="selectedItems" :route-type="props.routeType" :pageSize="10" checkboxType="button" />
                </div>
            </div>
            <div class="marginBottomTen">
                <el-button type="primary" @click="reqFunBatch">前端批量发送</el-button>
                <el-button @click="reqFunServerBatch">服务端批量发送</el-button>
                <el-button type="primary" @click="selectedItems = []">清空</el-button>
            </div>
            <div class="marginBottomTen">
                <el-button type="primary" @click="reqFunInterval">开启定时发送选择的第一个</el-button>
                <el-button type="primary" @click="reqFunIntervalClose">停止</el-button>
                <el-input style="width: 100px; margin-left: 10px;height: 32px" size="small" v-model="intervalObj.time" @input="changeIntervalTime" />
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'
import defaultValues from '@/constant/DEFAULT_VALUES'
import axios from 'axios'
import CheckboxPagination from '../components/Checkbox-Pagination.vue'

interface PropsRadioPagination {
    routeType: string
}

const props = withDefaults(defineProps<PropsRadioPagination>(), {
    routeType: ''
})

const nameWord = ref('')
const itemNum = ref('')
const selectedItems: any = ref([])
const reqType = ref('')
const keyWord = ref('')
const intervalObj: any = ref({
    time: 1000
})
let itemsList: any = ref([])

const reqPre = import.meta.env.DEV ? 'http://localhost:3000' : ''

let hasPage = computed({
    get() {
        return !!defaultValues[props.routeType]
    },
    set() {}
})

watch(() => props.routeType, () => initPage())

onMounted(() => {
    initPage()
})

const LSSaveValue = (type: string, value: any) => {
    window.localStorage.setItem(props.routeType + type, String(value))
}

//修改了定时器间隔
const changeIntervalTime = (value: string) => {
    LSSaveValue('IntervalTime', String(value))
}

//切换充值类型
const changeReqType = (type: string) => {
    selectedItems.value = []
    if (type) {
        reqType.value = type
        itemsList.value = defaultValues[props.routeType][type]
        LSSaveValue('reqType', type)
    }
}
//修改发送数目
const changeItemNumber = (value: string) => {
    LSSaveValue('itemNumber', value)
}
//过滤物品
const changeWupin = (value: string) => {
    LSSaveValue('filterName', value)
    if (value) {
        itemsList.value = defaultValues[props.routeType]?.mail.filter((i: ItemsSingle) => {
            return value && i.name.includes(value)
        })
    } else {
        itemsList.value = defaultValues[props.routeType]?.mail
    }
}
const changeName = (value: string) => {
    LSSaveValue('nameWord', value)
}
const selectedItemsClearOne = (i: ItemsSingle) => {
    selectedItems.value = selectedItems.value.filter((z: ItemsSingle) => {
        return z.value !== i.value
    })
    window.localStorage.setItem(props.routeType + 'itemId', JSON.stringify(selectedItems.value))
}
const reqFun = async (itemIds: any, url: string) => {
    if (itemIds && !itemIds.length) {
        itemIds = [itemIds]
    }
    await axios({
        method: 'post',
        url: url,
        data: {
            reqData: itemIds.map((i: ItemsSingle) => {
                return {
                    name: i.name,
                    formData: defaultValues[props.routeType]?.getReqFormData(reqType.value, nameWord.value, itemNum.value, i.value),
                    params: defaultValues[props.routeType]?.getReqParams(reqType.value, nameWord.value, itemNum.value, i.value),
                    realReqUrl: defaultValues[props.routeType]?.realReqUrl,
                    realReqMethod: defaultValues[props.routeType]?.realReqMethod
                }
            })
        }
    })
}
const delayReqFun = async (itemIds: any, url: string) => {
    return new Promise((resolve) => {
        setTimeout(() => {
            reqFun(itemIds, url)
            resolve('')
        }, intervalObj.value.time)
    })
}
const reqFunServerBatch = async () => {
    await reqFun(selectedItems.value, reqPre + '/apibatch')
}
const reqFunBatch = async () => {
    await reqFun(selectedItems.value[0], reqPre + '/api')
    for (let i = 1; i < selectedItems.value.length; i++) {
        await delayReqFun(selectedItems.value[i], reqPre + '/api')
    }
}
const reqFunInterval = () => {
    if (selectedItems.value && selectedItems.value.length > 0) {
        reqFun(selectedItems.value[0], reqPre + '/apiInterval')
    }
}
const reqFunIntervalClose = async () => {
    await axios({
        method: 'post',
        url: reqPre + '/closeinterval'
    })
}

const initPage = () => {
    if (props.routeType && defaultValues[props.routeType]) {
        nameWord.value = defaultValues[props.routeType]?.nameWord
        itemNum.value = defaultValues[props.routeType]?.itemNum
        keyWord.value = defaultValues[props.routeType]?.filterName
        intervalObj.value.time = defaultValues[props.routeType]?.sendIntervalTime
        changeReqType(defaultValues[props.routeType]?.reqType)
        selectedItems.value = defaultValues[props.routeType]?.itemId
        if (reqType.value === 'mail') {
            changeWupin(keyWord.value)
        }
    }
}
</script>

<style scoped src="../assets/game-req.scss"></style>
<style scoped lang="scss">
.flex-line > label {
    width: 60px;
}

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
