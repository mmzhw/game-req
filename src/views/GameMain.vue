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
        <game-req-new :routeType="routeOption.value" @addLogs="addLogs" />
        <table-pagination :dataList="logList" />
    </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GameReqNew from '@/views/GameReq.vue'
import TablePagination from '@/components/Table-Pagination.vue'
import { GAME_OPTIONS } from '@/constant/options'

let logList: any = ref([])

const router = useRouter()
const routeParams = useRoute().params as Record<string, string>
const routeType = ref<string>(routeParams.id || '')
const gameList = ref(GAME_OPTIONS)

let routeOption = computed(() => {
    return gameList.value.find((item: any) => item.value === routeType.value) || {}
})

onMounted(() => {
    initWs()
})
//跳转到版本控制
const jumpVersion = () => {
    router.push({ name: 'version' })
}

const changeRouteType = () => {
    router.push({ name: 'manage', params: { id: routeType.value } })
}

const addLogs = (message: any) => {
    logList.value.unshift({ no: logList.value.length + 1, message: message })
}
const initWs = () => {
    let ws: any = null
    let pingId: any = null
    ws = new WebSocket((window.location.protocol === 'https:' ? 'wss://' : 'wss://') + window.location.host)
    ws.onmessage = (response: any) => {
        if (response.data !== 'pong') {
            addLogs(response.data)
        }
    }
    ws.onopen = () => {
        addLogs('wss连接成功')
        pingId = setInterval(() => {
            ws.send('ping')
        }, 10000)
    }
    ws.onclose = ws.onerror = () => {
        addLogs('wss连接失败')
        clearInterval(pingId)
        pingId = null
        ws = null
        // setTimeout(() => {
        //     initWs()
        // }, 1000)
    }
}
</script>

<style scoped src="../assets/game-req.scss"></style>
<style scoped lang="scss">
:deep() {
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
    :deep() {
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
