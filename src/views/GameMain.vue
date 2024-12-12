<template>
    <div class="flex-column">
        <div class="flex-line marginBottomFive">
            <label @click="jumpVersion">选择：</label>
            <div class="gameTypeWrap">
                <el-radio-group v-model="routeType">
                    <el-radio-button v-for="(item, index) in gameList" :key="'game' + index" :label="item.value">{{ item.name }}</el-radio-button>
                </el-radio-group>
            </div>
        </div>
        <game-req v-if="routeOption.pageType === '1'" :routeType="routeOption.value" />
        <game-req-zcylt v-if="routeOption.pageType === '2'" :routeType="routeOption.value" />
        <game-req-djs v-if="routeOption.pageType === '3'" :routeType="routeOption.value" />
        <game-req-x-z-n v-if="routeOption.pageType === '4'" :routeType="routeOption.value" />
        <table-pagination :dataList="logList" />
    </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GameReqDjs from '@/views/GameReqDjs.vue'
import TablePagination from '@/components/Table-Pagination.vue'
import GameReq from '@/views/GameReq.vue'
import GameReqZcylt from '@/views/GameReqZcylt.vue'
import GameReqXZN from '@/views/GameReqXZN.vue'

const router = useRouter()
const routeParams = useRoute().params as Record<string, string>
let logList: any = ref([])
const routeType = ref<string>(routeParams.id || '')
const gameList = ref([
    { name: '古龙群侠传', value: 'glqxz', pageType: '1' },
    { name: '古剑奇谭', value: 'gjqt', pageType: '1' },
    { name: '梦幻江湖', value: 'mhjh', pageType: '1' },
    { name: '剑侠情缘', value: 'jxqy', pageType: '1' },
    { name: '这城有良田', value: 'zcylt', pageType: '2' },
    { name: '打僵尸', value: 'djs', pageType: '3' },
    { name: 'x战娘', value: 'xzn', pageType: '4' }
])

let routeOption = computed(() => {
    let option:any = gameList.value.find((item) => item.value === routeType.value) || {}
    return option
})

let ws: any = null
onMounted(() => {
    initWs()
})
//跳转到版本控制
const jumpVersion = () => {
    router.push({ name: 'version' })
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
        addLogs('ws连接失败')
        clearInterval(pingId)
        pingId = null
        ws = null
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
