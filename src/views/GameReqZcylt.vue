<template>
    <div class="flex-column">
        <div class="flex-column">
            <div class="flex-line" v-for="(item, index) in baseForm" :key="'base-form' + index">
                <label>{{ item.label }}：</label>
                <el-input v-model="item.value" @input="(value:string) => LSSaveValue(item.label, value)" />
            </div>
            <div class="flex-line">
                <label>已选：</label>
                <div style="line-height: 32px">
                    <template v-if="selectedItems?.length">
                        <el-tag class="marginRightFive" v-for="(i, index) in selectedItems" :key="'selected-good' + index" closable @close="clearSingleItem(i)">{{ i.name }}</el-tag>
                    </template>
                    <span v-else>暂未选择</span>
                </div>
            </div>
            <div class="flex-line">
                <label>过滤：</label>
                <div>
                    <el-input v-model="keyWord" placeholder="过滤" @input="changeWupin" />
                </div>
            </div>
            <checkbox-pagination :data-list="goodsList" v-model:currentItem="selectedItems" :routeType="routeType" :pageSize="50" checkboxType="default" />
            <div style="display: flex; padding-bottom: 10px">
                <el-button type="primary" @click="getGoods">发送</el-button>
                <el-button type="primary" @click="selectedItems = []">清空</el-button>
            </div>
            <table-pagination :dataList="logList" />
        </div>
    </div>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import CheckboxPagination from '../components/Checkbox-Pagination.vue'
import zcylt from '@/constant/zcylt'
import axios from 'axios'
import TablePagination from '@/components/Table-Pagination.vue'

const reqPre = import.meta.env.DEV ? 'http://localhost:3000' : ''

let logList: any = ref([])
const goodsList: any = ref(zcylt.WUPIN)
const selectedItems: any = ref([])
const keyWord: any = ref('')
const routeType: any = ref('zcylt')
const baseForm: any = ref([
    { label: '账号', value: window.localStorage.getItem(routeType.value + '账号') || 'mmzhw51' },
    { label: '数量', value: window.localStorage.getItem(routeType.value + '数量') || '1' }
])
let ws: any = null

onMounted(() => {
    initWs()
})

const LSSaveValue = (type: string, value: any) => {
    window.localStorage.setItem(routeType.value + type, String(value))
}
const changeWupin = (value: string) => {
    if (value) {
        goodsList.value = zcylt.WUPIN.filter((i: ItemsSingle) => {
            return value && i.name.includes(value)
        })
    } else {
        goodsList.value = zcylt.WUPIN
    }
}
const clearSingleItem = (i: ItemsSingle) => {
    selectedItems.value = selectedItems.value.filter((z: ItemsSingle) => {
        return z.value !== i.value
    })
}
const getGoods = async () => {
    for (let i = 0; i < selectedItems.value.length; i++) {
        await getGood(selectedItems.value[i])
        await new Promise(resolve => setTimeout(resolve, 1000))
    }
}
const getGood = async (i: ItemsSingle) => {
    // let formData = new FormData()
    // formData.append('type', 'mail')
    // formData.append('checknum', '123123')
    // formData.append('uid', 'mmzhw51')
    // formData.append('item', item.value)
    // formData.append('num', '1')
    // formData.append('qu', '1')
    // let result = await axios.post('http://101.33.236.73:8081/gm/user/gmquery.php', formData, {
    //     headers: {
    //         'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    //     }
    // })

    await axios({
        method: 'post',
        url: reqPre + '/api',
        data: {
            reqData: [
                {
                    name: i.name,
                    formData: {
                        type: 'mail',
                        checknum: '123123',
                        uid: baseForm.value.find((j:any) => j.label === '账号')?.value,
                        item: i.value,
                        num: baseForm.value.find((j:any) => j.label === '数量')?.value,
                        qu: '1'
                    },
                    realReqUrl: 'http://101.33.236.73:8081/gm/user/gmquery.php',
                    realReqMethod: 'post'
                }
            ]
        }
    })
}

const addLogs = (message: any) => {
    logList.value.unshift({ no: logList.value.length + 1, message: message })
}
const initWs = () => {
    let pingId: any = null
    ws = new WebSocket(import.meta.env.DEV ? 'ws://localhost:3000' : 'ws://' + window.location.host)
    ws.onmessage = (response: any) => {
        if (response.data !== 'pong') {
            addLogs(response.data)
        }
    }
    ws.onopen = () => {
        addLogs('ws连接成功')
        pingId = setInterval(() => {
            ws.send('ping')
        }, 10000)
    }
    ws.onclose = ws.onerror = () => {
        addLogs('ws断连')
        clearInterval(pingId)
        pingId = null
        ws = null
        setTimeout(()=>{
            initWs()
        },3000)
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
