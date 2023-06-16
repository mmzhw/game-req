<template>
    <div class="wrap">
        <el-input v-model="keyWord" placeholder="过滤" @input="changeWupin"/>
        <el-input v-model="nameWord" class="marginTopTen" @input="changeName"/>
        <el-select v-model="reqType" class="marginTopTen" placeholder="Select" @change="changeReqType">
            <el-option label="充值一" value="charge"/>
            <el-option label="充值二" value="charge2"/>
            <el-option label="邮件" value="mail"/>
        </el-select>
        <el-input v-model="itemNum" placeholder="数目" class="marginTopTen" @change="changeItemNumber"/>
        <div style="border: 1px solid #eeeeee;padding: 10px" class="marginTopTen wrap">
            <el-radio-group v-model="pageType" @change="changeList" v-if="reqType === 'mail'">
                <el-radio-button :label="2">分页</el-radio-button>
                <el-radio-button :label="1">全部</el-radio-button>
            </el-radio-group>
            <el-radio-group v-model="radio" class="marginTopTen" @change="changeItemId">
                <el-radio v-for="(item,index) in radioList" :key="index" :label="item.value">{{ item.name }}</el-radio>
            </el-radio-group>
            <el-pagination class="marginTopFive" v-if="reqType === 'mail' && pageType === 2" background hide-on-single-page layout="total, prev, pager, next" :total="listLength" :page-size="pageSize" @current-change="pageChange" @size-change="sieChange"/>
        </div>
        <el-button class="marginTopTen" type="primary" @click="reqFun">发送</el-button>
        <el-upload class="marginTopTen" action="/upload" :on-success="uploadSuccess" :on-error="uploadError" accept="zip">
            <el-button style="width: 100%">更新页面 v1.4</el-button>
        </el-upload>
        <el-divider/>
        <p v-for="(log,index) in logList" :key="'log'+index">{{ log }}</p>
    </div>
</template>

<script lang="ts" setup>
import {ref, reactive, onMounted} from 'vue'
import {WUPIN, CHARG_WUPIN, CHARG_2_WUPIN} from '@/constant/gulong'
import axios from "axios";
// import qs from 'qs'

const keyWord = ref('')
const nameWord = ref(window.localStorage.getItem('nameWord') || '桃花碧柔')
const itemNum = ref(window.localStorage.getItem('itemNumber'))
const radio = ref(window.localStorage.getItem('itemId'))
const reqType = ref(window.localStorage.getItem('reqType') || 'mail')
const pageType = ref(2)
const listLength = ref(WUPIN.length)
const pageSize = ref(10)
let radioList: any = ref([])
let logList: any = ref([])


//切换全部/分页
const changeList = (value: number) => {
    if (value === 1) {
        changeWupin(keyWord.value)
    } else {
        keyWord.value = ''
        radioList.value = WUPIN.slice(0, 10)
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
        radioList.value = CHARG_WUPIN
    } else if (type === 'charge2') {
        radioList.value = CHARG_2_WUPIN
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
        radioList.value = WUPIN.filter(i => {
            return (value && i.name.includes(value))
        })
        listLength.value = radioList.value.length
    }
}
const changeName = (value: string) => {
    window.localStorage.setItem('nameWord', value)
}
//翻页
const pageChange = (size: number) => {
    radioList.value = WUPIN.slice((size - 1) * pageSize.value, pageSize.value * size)
}
//分页数目切换
const sieChange = (sizes: number) => {
    pageSize.value = sizes
    pageChange(1)
}

onMounted(() => {
    changeReqType(reqType.value)
})

const getParams = () => {
    let reqParams: Record<string, any> = {
        'charge': {type: 'charge', username: nameWord.value, qu: 2, rechargeId: 10, number: Number(itemNum.value), rechargezId: '', znumber: 1, mailnum: 1},
        'charge2': {type: 'charge2', username: nameWord.value, qu: 2, rechargeId: 10, znumber: Number(itemNum.value), rechargezId: Number(radio.value), mailnum: 1},
        'mail': {type: 'mail', username: nameWord.value, mailid: Number(radio.value), mailnum: Number(itemNum.value), qu: 2, charge: 3}
    }
    return reqParams[reqType.value]
}

const reqFun = async () => {
    let result = await axios({
        method: 'post',
        url: '/api',
        data: {
            formData: getParams(),
            params: {act: 'send', sid: 1001}
        }
        // url: 'http://106.74.21.2:81/jkgm/user/playerapi.php',
        // data: qs.stringify(getParams()),
        // params: {act: 'send', sid: 1001}
    })
    logList.value.push(result?.data)
}

const uploadSuccess = (response:any) => {
    logList.value.push(response)
}
const uploadError = (response:any) => {
    logList.value.push(response)
}

</script>

<style scoped lang='scss'>
.marginTopTen {
    margin-top: 10px;
}

.marginTopFive {
    margin-top: 5px;
}

.wrap {
    padding: 10px;
    display: flex;
    flex-direction: column;
}
</style>
