<template>
    <div class="game-page">
        <game-req-new v-if="routeType" :routeType="routeType" @addLogs="addLogs" />
        <table-pagination :dataList="logList" />
    </div>
</template>

<script lang="ts" setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import GameReqNew from '@/views/GameReq.vue'
import TablePagination from '@/components/Table-Pagination.vue'
import { adminRequest } from '@/utils/admin-api'
import type { GameRecord } from '@/utils/game-templates'

let logList: any = ref([])

const route = useRoute()
const routeType = ref<string>(String(route.params.id || ''))

watch(() => route.params.id, async (id) => {
    routeType.value = String(id || '')
    const game = await adminRequest<GameRecord>(`/api/games/${encodeURIComponent(routeType.value)}`)
    document.title = `${game.name} - 后台发送`
}, { immediate: true, flush: 'post' })

onMounted(() => {
    initWs()
})
const addLogs = (message: any) => {
    logList.value.unshift({ no: logList.value.length + 1, message: message })
}

let ws: WebSocket | null = null
let pingId: number | null = null
let reconnectId: number | null = null

const initWs = () => {
    const wsUrl = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host + '/ws'

    // 如果已有连接，先关闭
    if (ws) {
        ws.close()
        ws = null
    }

    ws = new WebSocket(wsUrl)

    ws.onmessage = (response: MessageEvent) => {
        if (response.data !== 'pong') {
            addLogs(response.data)
        }
    }

    ws.onopen = () => {
        addLogs(`${wsUrl}连接成功`)
        pingId = window.setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send('ping')
            }
        }, 10000)
    }

    ws.onclose = () => {
        addLogs(`${wsUrl}连接关闭`)
        cleanup()
        reconnectId = window.setTimeout(() => {
            initWs()
        }, 1000)
    }

    ws.onerror = () => {
        addLogs(`${wsUrl}连接失败`)
    }
}

const cleanup = () => {
    if (reconnectId !== null) {
        window.clearTimeout(reconnectId)
        reconnectId = null
    }
    if (pingId) {
        clearInterval(pingId)
        pingId = null
    }
    if (ws) {
        ws.onclose = null
        ws.close()
        ws = null
    }
}

onUnmounted(() => {
    cleanup()
})
</script>

<style scoped>
.game-page {
    display: grid;
    gap: 20px;
    min-width: 0;
}

@media (max-width: 768px) {
    .game-page { gap: 14px; }
}
</style>
