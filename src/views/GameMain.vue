<template>
    <div class="flex-column">
        <div class="flex-line marginBottomFive">
            <label @click="jumpVersion">类型：</label>
            <div class="gameTypeWrap">
                <el-radio-group v-model="routeType" @change="changeRouteType">
                    <el-radio-button v-for="(item, index) in gameList" :key="'game' + index" :value="item.value">{{ item.name }}</el-radio-button>
                </el-radio-group>
            </div>
        </div>
        <game-req-new :routeType="routeOption.value" @addLogs="addLogs"/>
        <table-pagination :dataList="logList"/>
    </div>
</template>

<script lang="ts" setup>
import {computed, onMounted, ref} from 'vue'
import {useRoute, useRouter} from 'vue-router'
import GameReqNew from '@/views/GameReqNew.vue'
import TablePagination from '@/components/Table-Pagination.vue'

let logList: any = ref([])

const router = useRouter()
const routeParams = useRoute().params as Record<string, string>
const routeType = ref<string>(routeParams.id || '')
const gameList = ref([
    {name: '这城有良田', value: 'zcylt', pageType: '2'},
    {name: '打僵尸', value: 'djs', pageType: '3'},
    {name: 'x战娘', value: 'xzn', pageType: '4'},
    {name: '墨迹大侠', value: 'mjdx', pageType: '5'},
    {name: '万灵', value: 'wl', pageType: '6'},
    {name: '三国猫', value: 'sgm', pageType: '7'},
])

let routeOption = computed(() => {
    let option: any = gameList.value.find((item) => item.value === routeType.value) || {}
    return option
})

onMounted(() => {
    initWs()
})
//跳转到版本控制
const jumpVersion = () => {
    router.push({name: 'version'})
}

const changeRouteType = () => {
    router.push({name: 'manage', params: {id: routeType.value}})
}

const addLogs = (message: any) => {
    logList.value.unshift({no: logList.value.length + 1, message: message})
}
const initWs = () => {
    let ws: any = null
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
        addLogs('ws连接失败')
        clearInterval(pingId)
        pingId = null
        ws = null
        setTimeout(() => {
            initWs()
        }, 1000)
    }
}
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
