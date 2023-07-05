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
            <div class="flex-line">
                <label>已选：</label>
                <div style="line-height: 32px">
                    <el-tag
                        class="marginRightFive"
                        v-for="(i, index) in choosedItem"
                        :key="'yixuan' + index"
                        closable
                        @close="choosedItemClearOne(i)"
                        >{{ i.name }}
                    </el-tag>
                </div>
            </div>
            <div class="flex-line" v-if="reqType === 'mail'">
                <label>过滤：</label>
                <div>
                    <el-input v-model="keyWord" placeholder="过滤" @input="changeWupin" />
                </div>
            </div>
            <checkbox-pagination
                :data-list="itemsList"
                v-model:currentItem="choosedItem"
                :route-type="routeType"
            />
            <div class="flex-space-between marginBottomTen">
                <el-button
                    class="marginBottomTen"
                    style="width: calc((100% - 70px) / 2)"
                    type="primary"
                    @click="reqFunBatch"
                    >前端批量发送
                </el-button>
                <el-button
                    class="marginBottomTen"
                    style="width: calc((100% - 70px) / 2); margin-left: 10px"
                    type="primary"
                    @click="reqFunServerBatch"
                    >服务端批量发送
                </el-button>
                <el-button
                    style="width: 50px; margin-left: 10px"
                    type="primary"
                    @click="choosedItem = []"
                    >清空
                </el-button>
            </div>
            <div class="flex-space-between marginBottomTen">
                <el-button style="flex: 1" type="primary" @click="reqFunInterval"
                    >开启定时发送选择的第一个
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
// import RadioPagination from '../components/Radio-Pagination.vue'
import CheckboxPagination from '../components/Checkbox-Pagination.vue'
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const routeParams = useRoute().params as Record<string, string>
const routeType = ref<string>(routeParams.id || '')
const gameList = ref(defaultValues.list)
const nameWord = ref('')
const itemNum = ref('')
const choosedItem: any = ref([])
const reqType = ref('')
const keyWord = ref('')
const intervalObj: any = ref({
    time: 1000
})
let itemsList: any = ref([])
let logList: any = ref([])

let ws:any = null
const reqPre = import.meta.env.DEV ? 'http://localhost:3000' : ''

let hasPage = computed({
    get() {
        return !!defaultValues[routeType.value]
    },
    set() {}
})

onMounted(() => {
    initPage('')
    initWs()
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
    choosedItem.value = []
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
const choosedItemClearOne = (i: ItemsSingle) => {
    choosedItem.value = choosedItem.value.filter((z: ItemsSingle) => {
        return z.value !== i.value
    })
    window.localStorage.setItem(routeType.value + 'itemId', JSON.stringify(choosedItem.value))
}
const reqFun = async (itemIds: any, url: string) => {
    if (itemIds && !itemIds.length) {
        itemIds = [itemIds]
    }
    await axios({
        method: 'post',
        url: url,
        data: {
            interval: intervalObj.value.time,
            reqData: itemIds.map((i: ItemsSingle) => {
                return {
                    name: i.name,
                    formData: defaultValues[routeType.value]?.getReqFormData(
                        reqType.value,
                        nameWord.value,
                        itemNum.value,
                        i.value
                    ),
                    params: defaultValues[routeType.value]?.getReqParams(
                        reqType.value,
                        nameWord.value,
                        itemNum.value,
                        i.value
                    ),
                    realReqUrl: defaultValues[routeType.value]?.realReqUrl,
                    realReqMethod: defaultValues[routeType.value]?.realReqMethod
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
    await reqFun(choosedItem.value, reqPre + '/apibatch')
}
const reqFunBatch = async () => {
    await reqFun(choosedItem.value[0], reqPre + '/api')
    for (let i = 1; i < choosedItem.value.length; i++) {
        await delayReqFun(choosedItem.value[i], reqPre + '/api')
    }
}
const reqFunInterval = () => {
    if (choosedItem.value && choosedItem.value.length > 0) {
        reqFun(choosedItem.value[0], reqPre + '/apiInterval')
    }
}
const reqFunIntervalClose = async () => {
    let result = await axios({
        method: 'post',
        url: reqPre + '/closeinterval'
    })
    addLogs(result?.data)
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
        keyWord.value = defaultValues[routeType.value]?.filterName
        intervalObj.value.time = defaultValues[routeType.value]?.sendIntervalTime
        changeReqType(defaultValues[routeType.value]?.reqType)
        choosedItem.value = defaultValues[routeType.value]?.itemId
        if (reqType.value === 'mail') {
            changeWupin(keyWord.value)
        }
    }
}

const initWs = () => {
    let pingId:any = null
    ws = new WebSocket(
        import.meta.env.DEV ? 'ws://localhost:3000' : 'wss://' + window.location.host
    )
    ws.onmessage = (response:any) => {
        if (response.data !== 'pong'){
            addLogs(response.data)
        }
    }
    ws.onopen = () => {
        addLogs('ws连接成功')
        // ws.send('123');
        setInterval(() => {
            ws.send('ping')
        }, 10000)
    }
    ws.onclose = ws.onerror = () => {
        addLogs('ws断连')
        clearInterval(pingId)
        pingId = null
        ws = null
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

.marginRightFive {
    margin-right: 5px;
}
</style>
