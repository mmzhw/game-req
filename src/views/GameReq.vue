<template>
    <div class="flex-column paddingTen">
        <control-server
            @uploadSuccess="addLogs"
            @uploadError="addLogs"
            label-width="55"
        ></control-server>
        <div class="flex-line marginBottomFive">
            <label>选择：</label>
            <div class="gameTypeWrap">
                <el-radio-group v-model="routeType" @change="changeRouteType">
                    <el-radio-button
                        v-for="(item, index) in gameList"
                        :key="'game' + index"
                        :label="item.value"
                        >{{ item.name }}</el-radio-button
                    >
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
            <el-radio-group
                class="marginBottomFive"
                :class="isMobile && 'mobileRadio'"
                v-model="choosedItem"
                @change="changeItemId"
            >
                <el-radio-button
                    v-for="(item, index) in realItemsList"
                    :key="index"
                    :label="item.value"
                    >{{ item.name }}
                </el-radio-button>
            </el-radio-group>
            <el-pagination
                class="marginBottomTen"
                :class="isMobile && 'pagePaginationMobile'"
                background
                :layout="pageObj.layout"
                :page-sizes="pageObj.sizes"
                :total="itemsList?.length"
                :page-size="pageObj.size"
                :current-page="pageObj.current"
                @current-change="pageCurrentChange"
                @size-change="pageSizeChange"
            >
                <template #default
                    ><span>{{ pageObj.current }}页 / {{ itemsList?.length }}条</span></template
                >
            </el-pagination>
            <el-button class="marginBottomTen" style="width: 100%" type="primary" @click="reqFun"
                >发送</el-button
            >
            <div class="flex-space-between marginBottomTen">
                <el-button
                    :disabled="intervalObj.id"
                    style="flex: 1"
                    type="primary"
                    @click="reqFunInterval"
                    >开启定时发送</el-button
                >
                <el-button
                    style="width: 50px; margin-left: 10px"
                    type="primary"
                    @click="reqFunIntervalClose"
                    >停止</el-button
                >
                <el-input
                    style="width: 50px; margin-left: 10px"
                    size="small"
                    v-model="intervalObj.time"
                    @input="changeIntervalTime"
                />
            </div>
            <el-table :data="realLogList" style="width: 100%" border>
                <el-table-column prop="no" label="序号" width="80" />
                <el-table-column prop="message" label="内容" />
            </el-table>
            <el-pagination
                class="marginTopFive"
                :class="isMobile && 'pagePaginationMobile'"
                :layout="pageObj.layout"
                :page-sizes="pageLogObj.sizes"
                :total="logList?.length"
                :page-size="pageLogObj.size"
                :current-page="pageLogObj.current"
                @current-change="pageLogCurrentChange"
                @size-change="pageLogSizeChange"
            >
                <template #default
                    ><span>{{ pageObj.current }}页 / {{ itemsList?.length }}条</span></template
                >
            </el-pagination>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'
import defaultValues from '@/constant/DEFAULT_VALUES'
import axios from 'axios'
import ControlServer from '../components/Control-Server.vue'
import { useRoute, useRouter } from 'vue-router'

let routerParams = useRoute().params
const router = useRouter()
const routeType = ref(routerParams?.id || '')
const gameList = ref(defaultValues.list)
const nameWord = ref('')
const itemNum = ref('')
const choosedItem = ref('')
const reqType = ref('')
const keyWord = ref('')
const isMobile = ref(/mobile/i.test(navigator.userAgent))
const pageObj: any = ref({
    size: 10,
    sizes: [10, 20, 50, 100, 1000, 5000],
    current: 1,
    layout: ''
})
const pageLogObj: any = ref({
    size: 5,
    sizes: [10, 20, 50, 100, 1000, 5000],
    current: 1
})
const intervalObj: any = ref({
    id: null,
    time: 1000
})
let itemsList: any = ref([])
let logList: any = ref([])

let hasPage = computed({
    get() {
        return !!defaultValues[routeType.value as string]
    },
    set() {}
})
let realItemsList = computed(() => {
    return itemsList.value.slice(
        pageObj.value.size * (pageObj.value.current - 1),
        pageObj.value.size * pageObj.value.current
    )
})
let realLogList = computed(() => {
    return logList.value.slice(
        pageLogObj.value.size * (pageLogObj.value.current - 1),
        pageLogObj.value.size * pageLogObj.value.current
    )
})

onMounted(() => {
    if (isMobile.value) {
        pageObj.value.layout = 'prev, next, sizes, ->, slot'
    } else {
        pageObj.value.layout = 'prev, pager, next, jumper, sizes, ->, total'
    }
    initPage('')
})

const LSSaveValue = (type: string, value: any) => {
    window.localStorage.setItem(routeType.value + type, String(value))
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

//切换物品id
const changeItemId = (item: number) => {
    LSSaveValue('itemId', String(item))
}
//切换充值类型
const changeReqType = (type: string) => {
    if (type) {
        reqType.value = type
        itemsList.value = defaultValues[routeType.value as string][type]
        pageObj.value.current = 1
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
        itemsList.value = defaultValues[routeType.value as string]?.mail.filter(
            (i: ItemsSingle) => {
                return value && i.name.includes(value)
            }
        )
    } else {
        itemsList.value = defaultValues[routeType.value as string]?.mail
    }
}
const changeName = (value: string) => {
    LSSaveValue('nameWord', value)
}
//翻页
const pageCurrentChange = (size: number) => {
    pageObj.value.current = size
}
//分页数目切换
const pageSizeChange = (sizes: number) => {
    pageObj.value.size = sizes
    pageObj.value.current = 1
}

//日志翻页
const pageLogCurrentChange = (size: number) => {
    pageLogObj.value.current = size
}
//日志分页数目切换
const pageLogSizeChange = (sizes: number) => {
    pageLogObj.value.size = sizes
    pageLogObj.value.current = 1
}

const reqFun = async () => {
    let result = await axios({
        method: 'post',
        url: '/api',
        data: {
            formData: defaultValues[routeType.value as string]?.getReqFormData(
                reqType.value,
                nameWord.value,
                itemNum.value,
                choosedItem.value
            ),
            params: defaultValues[routeType.value as string]?.getReqParams(
                reqType.value,
                nameWord.value,
                itemNum.value,
                choosedItem.value
            ),
            realReqUrl: defaultValues[routeType.value as string]?.realReqUrl,
            realReqMethod: defaultValues[routeType.value as string]?.realReqMethod
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
    if (routeType.value && defaultValues[routeType.value as string]) {
        nameWord.value = defaultValues[routeType.value as string]?.nameWord
        itemNum.value = defaultValues[routeType.value as string]?.itemNum
        choosedItem.value = defaultValues[routeType.value as string]?.itemId
        keyWord.value = defaultValues[routeType.value as string]?.filterName
        intervalObj.value.time = defaultValues[routeType.value as string]?.sendIntervalTime
        changeReqType(defaultValues[routeType.value as string]?.reqType)
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

.mobileRadio {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;

    :deep {
        .el-radio-button {
            width: calc((100% - 10px) / 2);
            margin: 0;

            .el-radio-button__inner {
                width: 100%;
                font-size: 12px;
                border-radius: 4px !important;
            }
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

.pagePaginationMobile {
    :deep {
        .el-pagination__sizes {
            margin-left: 5px;
        }
    }
}
</style>
