<template>
    <div class="wrap">
        <div class="flex-line">
            <label>发送账号id：</label>
            <div>
                <el-input v-model="nameWord" @input="changeName" />
            </div>
        </div>
        <div class="flex-line">
            <label>发送类型：</label>
            <div>
                <el-select v-model="reqType" placeholder="Select" @change="changeReqType">
                    <el-option label="充值一" value="charge" />
                    <el-option label="邮件" value="mail" />
                </el-select>
            </div>
        </div>
        <div class="flex-line">
            <label>发送数目：</label>
            <div>
                <el-input v-model="itemNum" placeholder="数目" @change="changeItemNumber" />
            </div>
        </div>

        <div class="flex-line" v-if="reqType === 'mail'">
            <label>过滤物品：</label>
            <div>
                <el-input v-model="keyWord" placeholder="过滤" @input="changeWupin" />
            </div>
        </div>
        <div class="flex-line" v-if="reqType === 'mail'">
            <label>展示方式：</label>
            <div>
                <el-radio-group v-model="pageType" @change="changeList">
                    <el-radio-button :label="2">分页</el-radio-button>
                    <el-radio-button :label="1">全部</el-radio-button>
                </el-radio-group>
            </div>
        </div>
        <div class="flex-line">
            <label>物品展示：</label>
            <div ref="pageDiv">
                <template v-if="radioList?.length > 0">
                    <el-radio-group v-model="radio" @change="changeItemId">
                        <el-radio
                            v-for="(item, index) in radioList"
                            :key="index"
                            :label="item.value"
                            >{{ item.name }}
                        </el-radio>
                    </el-radio-group>
                    <el-pagination
                        class="marginTopFive"
                        v-if="reqType === 'mail' && pageType === 2"
                        background
                        hide-on-single-page
                        small
                        layout="prev, pager, next"
                        :total="listLength"
                        :page-size="pageSize"
                        :pager-count="pagerCount"
                        @current-change="pageChange"
                        @size-change="sieChange"
                    />
                </template>
                <p v-else>无数据</p>
            </div>
        </div>
        <div class="flex-line">
            <label>执行：</label>
            <div style="display: flex">
                <el-button style="margin-right: 10px" type="primary" @click="reqFun"
                    >发送</el-button
                >
            </div>
        </div>
        <control-server
            @uploadSuccess="uploadSuccess"
            @uploadError="uploadError"
            label-width="98"
        ></control-server>
        <el-divider />
        <p v-for="(log, index) in logList" :key="'log' + index">{{ log }}</p>
    </div>
</template>

<script lang="ts" setup>
import { ref, reactive, onMounted } from 'vue'
import gujianqitan from '@/constant/gujianqitan'
import axios from 'axios'
import ControlServer from '../components/Control-Server.vue'
// import qs from 'qs'

const keyWord = ref('')
const nameWord = ref(window.localStorage.getItem('nameWord') || '31505037001')
const itemNum = ref(window.localStorage.getItem('itemNumber'))
const radio = ref(window.localStorage.getItem('itemId'))
const reqType = ref(window.localStorage.getItem('reqType') || 'mail')
const pageType = ref(2)
const listLength = ref(gujianqitan.WUPIN.length)
const pageSize = ref(10)
const pagerCount = ref(5)
let radioList: any = ref([])
let logList: any = ref([])
const pageDiv = ref<HTMLElement>()

//切换全部/分页
const changeList = (value: number) => {
    if (value === 1) {
        radioList.value = gujianqitan.WUPIN
    } else {
        keyWord.value = ''
        radioList.value = gujianqitan.WUPIN.slice(0, 10)
    }
}
//切换物品id
const changeItemId = (item: number) => {
    window.localStorage.setItem('itemId', String(item))
}
//切换充值类型
const changeReqType = (type: string) => {
    reqType.value = type
    if (type === 'charge') {
        radioList.value = gujianqitan.CHARG_WUPIN
    } else if (type === 'mail') {
        changeList(2)
    }
    window.localStorage.setItem('reqType', type)
}
//修改发送数目
const changeItemNumber = (value: string) => {
    window.localStorage.setItem('itemNumber', value)
}
//过滤物品
const changeWupin = (value: string) => {
    if (value) {
        pageType.value = 1
        radioList.value = gujianqitan.WUPIN.filter((i) => {
            return value && i.name.includes(value)
        })
        listLength.value = radioList.value.length
    }
}
const changeName = (value: string) => {
    window.localStorage.setItem('nameWord', value)
}
//翻页
const pageChange = (size: number) => {
    radioList.value = gujianqitan.WUPIN.slice((size - 1) * pageSize.value, pageSize.value * size)
}
//分页数目切换
const sieChange = (sizes: number) => {
    pageSize.value = sizes
    pageChange(1)
}

const getParams = () => {
    let reqParams: Record<string, any> = {
        charge: {
            action: 'charge',
            qid: 1,
            uid: 31505037001,
            chargeid: Number(radio.value)
        },
        mail: {
            action: 'senditem',
            qid: 1,
            uid: 31505037001,
            itemid: Number(radio.value),
            itemnum: Number(itemNum.value)
        }
    }
    return reqParams[reqType.value]
}

const reqFun = async () => {
    let result = await axios({
        method: 'post',
        url: '/api',
        data: {
            formData: getParams(),
            realReqUrl: 'http://61.171.55.117:8090/ht/gm/query.php',
            realReqMethod: 'post'
        }
    })
    logList.value.push(result?.data)
}

const uploadSuccess = (response: any) => {
    logList.value.push(response)
}
const uploadError = (response: any) => {
    logList.value.push(response)
}

onMounted(() => {
    changeReqType(reqType.value)
    pagerCount.value = Math.floor(pageDiv!.value!.offsetWidth / 3 / 24)
    window.onresize = () => {
        pagerCount.value = Math.floor(pageDiv!.value!.offsetWidth / 3 / 24)
    }
})
</script>

<style scoped src="../assets/game-req.scss"></style>
