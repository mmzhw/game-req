<template>
    <div class="wrap">
        <div class="flex-line">
            <label>发送姓名：</label>
            <div>
                <el-input v-model="nameWord" @input="changeName" />
            </div>
        </div>
        <div class="flex-line">
            <label>发送类型：</label>
            <div>
                <el-select v-model="reqType" placeholder="Select" @change="changeReqType">
                    <el-option label="充值一" value="charge" />
                    <el-option label="充值二" value="charge2" />
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
                    >发送
                </el-button>
            </div>
        </div>
        <control-server
            @uploadSuccess="uploadSuccess"
            @uploadError="uploadError"
            label-width="85"
        ></control-server>
        <el-divider />
        <p v-for="(log, index) in logList" :key="'log' + index">{{ log }}</p>
    </div>
</template>

<script lang="ts" setup>
import { ref, reactive, onMounted } from 'vue'
import gulong from '@/constant/gulong'
import axios from 'axios'
import ControlServer from '../components/Control-Server.vue'

// import qs from 'qs'

const keyWord = ref('')
const nameWord = ref(window.localStorage.getItem('nameWord') || '桃花碧柔')
const itemNum = ref(window.localStorage.getItem('itemNumber'))
const radio = ref(window.localStorage.getItem('itemId'))
const reqType = ref(window.localStorage.getItem('reqType') || 'mail')
const pageType = ref(2)
const listLength = ref(gulong.WUPIN.length)
const pageSize = ref(10)
const pagerCount = ref(5)
let radioList: any = ref([])
let logList: any = ref([])
const pageDiv = ref<HTMLElement>()

//切换全部/分页
const changeList = (value: number) => {
    if (value === 1) {
        radioList.value = gulong.WUPIN
    } else {
        keyWord.value = ''
        radioList.value = gulong.WUPIN.slice(0, 10)
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
        radioList.value = gulong.CHARG_WUPIN
    } else if (type === 'charge2') {
        radioList.value = gulong.CHARG_2_WUPIN
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
        radioList.value = gulong.WUPIN.filter((i) => {
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
    radioList.value = gulong.WUPIN.slice((size - 1) * pageSize.value, pageSize.value * size)
}
//分页数目切换
const sieChange = (sizes: number) => {
    pageSize.value = sizes
    pageChange(1)
}

const getParams = () => {
    let reqParams: Record<string, any> = {
        charge: {
            type: 'charge',
            username: nameWord.value,
            qu: 2,
            rechargeId: 10,
            number: Number(itemNum.value),
            rechargezId: '',
            znumber: 1,
            mailnum: 1
        },
        charge2: {
            type: 'charge2',
            username: nameWord.value,
            qu: 2,
            rechargeId: 10,
            znumber: Number(itemNum.value),
            rechargezId: Number(radio.value),
            mailnum: 1
        },
        mail: {
            type: 'mail',
            username: nameWord.value,
            mailid: Number(radio.value),
            mailnum: Number(itemNum.value),
            qu: 2,
            charge: 3
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
            params: { act: 'send', sid: 1001 },
            realReqUrl: 'http://106.74.21.2:81/jkgm/user/playerapi.php',
            realReqMethod: 'post'
        }
        // url: 'http://106.74.21.2:81/jkgm/user/playerapi.php',
        // data: qs.stringify(getParams()),
        // params: {act: 'send', sid: 1001}
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
<style scoped lang="scss">
.flex-line > label {
    width: 85px;
}
</style>
