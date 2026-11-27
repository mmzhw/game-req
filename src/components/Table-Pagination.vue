<template>
    <div class="log-panel">
        <el-table class="log-table" :data="realList" style="width: 100%" border>
            <el-table-column prop="no" label="序号" width="80" />
            <el-table-column label="平台结果">
                <template #default="{ row }">
                    <div class="log-summary" :title="getLogSummary(row.message)">{{ getLogSummary(row.message) }}</div>
                </template>
            </el-table-column>
            <el-table-column label="操作" width="80" align="center" fixed="right">
                <template #default="{ row }">
                    <el-button link type="primary" @click="showDetail(row)">详情</el-button>
                </template>
            </el-table-column>
        </el-table>
        <el-pagination
            class="game-pagination log-pagination"
            :layout="layout"
            :page-sizes="sizes"
            :total="dataList?.length"
            :page-size="size"
            :current-page="current"
            @current-change="pageCurrentChange"
            @size-change="pageSizeChange"
            background
        >
            <template #default>
                <span>{{ current }}页 / {{ dataList?.length }}条</span>
            </template>
        </el-pagination>
    </div>
    <el-drawer v-model="detailVisible" :title="detailTitle" :size="isMobile ? '90%' : '60%'" body-class="log-drawer-body">
        <el-scrollbar class="log-detail-scroll" :tabindex="0">
            <pre class="log-detail">{{ detailLog?.message }}</pre>
        </el-scrollbar>
    </el-drawer>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{
    dataList: Array<{ no: number; message: string }>
}>()

const size = ref(10)
const sizes = ref([10, 20, 50, 100, 200, 300, 400, 500, 1000, 5000])
const current = ref(1)
const layout = ref('')

const mobileQuery = window.matchMedia('(max-width: 700px)')
const isMobile = ref(mobileQuery.matches)
const updateMobile = (event: MediaQueryListEvent) => { isMobile.value = event.matches }
const detailVisible = ref(false)
const detailLog = ref<any>(null)
const detailTitle = computed(() => (detailLog.value ? `日志详情 #${detailLog.value.no}` : '日志详情'))

let realList = computed(() => {
    return props.dataList?.slice(size.value * (current.value - 1), size.value * current.value)
})

const getLogSummary = (message: string) => {
    const text = String(message || '').trim()
    const responseMarker = '\n[响应]\n'
    const responseIndex = text.lastIndexOf(responseMarker)
    if (responseIndex === -1) {
        return text.split('\n')[0]
    }

    const header = text.split('\n')[0]?.trim()
    const responseText = text.slice(responseIndex + responseMarker.length).trim()
    if (!responseText) {
        return header
    }

    const responseLines = responseText.split('\n')
    const statusLine = responseLines.shift()?.trim() || ''
    const body = responseLines.join('\n').trim()
    if (!body) {
        return [header, statusLine].filter(Boolean).join('  |  ')
    }

    let result = ''
    try {
        const data = JSON.parse(body)
        const responseMessage = data && typeof data === 'object' ? data.message ?? data.msg ?? data.errmsg : ''
        result = responseMessage !== undefined && responseMessage !== null && String(responseMessage).trim() ? String(responseMessage).trim() : JSON.stringify(data)
    } catch (e) {
        result = body.split('\n').find((line) => line.trim())?.trim() || statusLine
    }
    return [header, result].filter(Boolean).join('  |  ')
}

const showDetail = (row: any) => {
    detailLog.value = row
    detailVisible.value = true
}

onMounted(() => {
    mobileQuery.addEventListener('change', updateMobile)
})
onUnmounted(() => mobileQuery.removeEventListener('change', updateMobile))
watch(isMobile, (mobile) => {
    layout.value = mobile ? 'prev, pager, next' : 'prev, pager, next, jumper, sizes, ->, total'
}, { immediate: true })

const pageCurrentChange = (size: number) => {
    current.value = size
}

const pageSizeChange = (sizes: number) => {
    size.value = sizes
    current.value = 1
}
</script>
<style scoped lang="scss" src="../assets/game-req.scss"></style>
<style scoped lang="scss">
.log-panel {
    min-width: 0;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius);
    background: var(--ui-surface);
    box-shadow: var(--ui-shadow);
}

.log-table {
    --el-table-border-color: var(--ui-border);
    --el-table-header-bg-color: var(--ui-bg);
    --el-table-header-text-color: var(--ui-muted);
    --el-table-text-color: var(--ui-text);
    --el-table-row-hover-bg-color: var(--ui-accent-soft);

    border-radius: var(--ui-radius) var(--ui-radius) 0 0;
    font-variant-numeric: tabular-nums;

    :deep(.el-button.is-link) { min-height: 32px; }
}

.log-pagination {
    padding: 12px;
}

.log-summary {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

:global(.el-drawer__body.log-drawer-body) {
    min-height: 0;
    padding: 0;
    overflow: hidden;
}

.log-detail-scroll {
    height: 100%;

    :deep(.el-scrollbar__view) { padding: 0 var(--el-drawer-padding-primary) var(--el-drawer-padding-primary); }
    :deep(.el-scrollbar__wrap:focus-visible) { outline-offset: -2px; }
}

.log-detail {
    margin: 0;
    padding: 14px;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius);
    background: var(--ui-bg);
    color: var(--ui-text);
    font-family: ui-monospace, Consolas, monospace;
    font-size: 13px;
    line-height: 1.6;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

@media (max-width: 768px) {
    .log-pagination { justify-content: center; }

    .log-table :deep(.el-button.is-link) {
        min-width: 36px;
        min-height: 36px;
    }
}
</style>
