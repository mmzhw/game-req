<template>
    <div class="flex-column">
        <div class="flex-line marginBottomFive">
            <label @click="jumpVersion">选择：</label>
            <div class="gameTypeWrap">
                <el-radio-group v-model="routeType" @change="changeRouteType">
                    <el-radio-button
                        v-for="(item, index) in gameList"
                        :key="'game' + index"
                        :label="item.value"
                        >{{ item.name }}
                    </el-radio-button>
                </el-radio-group>
            </div>
        </div>
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
                    <el-select
                        style="width: 100%"
                        v-model="reqType"
                        placeholder="Select"
                        @change="changeReqType"
                    >
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
            <div class="flex-line" v-if="reqType === 'mail'">
                <label>过滤：</label>
                <div>
                    <el-input v-model="keyWord" placeholder="过滤" @input="changeWupin" />
                </div>
            </div>
            <radio-pagination
                :data-list="itemsList"
                v-model:currentItem="choosedItem"
                :route-type="routeType"
            />
            <el-button class="marginBottomTen" style="width: 100%" type="primary" @click="reqFun"
                >发送
            </el-button>
            <div class="flex-space-between marginBottomTen">
                <el-button
                    :disabled="intervalObj.id"
                    style="flex: 1"
                    type="primary"
                    @click="reqFunInterval"
                    >开启定时发送
                </el-button>
                <el-button
                    style="width: 50px; margin-left: 10px"
                    type="primary"
                    @click="reqFunIntervalClose"
                    >停止
                </el-button>
                <el-input
                    style="width: 50px; margin-left: 10px"
                    size="small"
                    v-model="intervalObj.time"
                    @input="changeIntervalTime"
                />
            </div>
            <table-pagination :dataList="logList" />
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import defaultValues from '@/constant/DEFAULT_VALUES'
import axios from 'axios'
import TablePagination from '../components/Table-Pagination.vue'
import RadioPagination from '../components/Radio-Pagination.vue'
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const routeParams = useRoute().params as Record<string, string>
const routeType = ref<string>(routeParams.id || '')
const gameList = ref(defaultValues.list)
const nameWord = ref('')
const itemNum = ref('')
const choosedItem = ref('')
const reqType = ref('')
const keyWord = ref('')
const intervalObj: any = ref({
    id: null,
    time: 1000
})
let itemsList: any = ref([])
let logList: any = ref([])

let hasPage = computed({
    get() {
        return !!defaultValues[routeType.value]
    },
    set() {}
})

onMounted(() => {
    initPage('')
})

const LSSaveValue = (type: string, value: any) => {
    window.localStorage.setItem(routeType.value + type, String(value))
}

//跳转到版本控制
const jumpVersion = () => {
    router.push({ name: 'version' })
}

//切换页面
const changeRouteType = (value: string) => {
    router.push({ name: 'manage', params: { id: value } })
    initPage(value)
}

//修改了定时器间隔
const changeIntervalTime = (value: string) => {
    LSSaveValue('IntervalTime', String(value))
}

//切换充值类型
const changeReqType = (type: string) => {
    if (type) {
        reqType.value = type
        itemsList.value = defaultValues[routeType.value][type]
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
        itemsList.value = defaultValues[routeType.value]?.mail.filter((i: ItemsSingle) => {
            return value && i.name.includes(value)
        })
    } else {
        itemsList.value = defaultValues[routeType.value]?.mail
    }
}
const changeName = (value: string) => {
    LSSaveValue('nameWord', value)
}

const reqFun = async () => {
    let result = await axios({
        method: 'post',
        url: '/api',
        data: {
            formData: defaultValues[routeType.value]?.getReqFormData(
                reqType.value,
                nameWord.value,
                itemNum.value,
                choosedItem.value
            ),
            params: defaultValues[routeType.value]?.getReqParams(
                reqType.value,
                nameWord.value,
                itemNum.value,
                choosedItem.value
            ),
            realReqUrl: defaultValues[routeType.value]?.realReqUrl,
            realReqMethod: defaultValues[routeType.value]?.realReqMethod
        }
    })
    addLogs(result?.data)
}
const reqFunInterval = () => {
    if (intervalObj.value.id) {
        return
    }
    intervalObj.value.id = setInterval(() => {
        reqFun()
    }, intervalObj.value.time)
}
const reqFunIntervalClose = () => {
    if (intervalObj.value.id) {
        clearInterval(intervalObj.value.id)
        intervalObj.value.id = null
    }
}
const addLogs = (message: any) => {
    logList.value.unshift({ no: logList.value.length + 1, message: message })
}

const initPage = (id: string) => {
    if (id) {
        routeType.value = id
    }
    if (routeType.value && defaultValues[routeType.value]) {
        nameWord.value = defaultValues[routeType.value]?.nameWord
        itemNum.value = defaultValues[routeType.value]?.itemNum
        choosedItem.value = defaultValues[routeType.value]?.itemId
        keyWord.value = defaultValues[routeType.value]?.filterName
        intervalObj.value.time = defaultValues[routeType.value]?.sendIntervalTime
        changeReqType(defaultValues[routeType.value]?.reqType)
        if (reqType.value === 'mail') {
            changeWupin(keyWord.value)
        }
    }
}
</script>

<style scoped src="../assets/game-req.scss"></style>
<style scoped lang="scss">
.flex-line > label {
    width: 55px;
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
</style>
