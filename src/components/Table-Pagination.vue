<template>
    <el-table :data="realList" style="width: 100%" border>
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
        class="marginTopFive paddingBottomTen"
        :class="isMobile && 'pagePaginationMobile'"
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
    <el-drawer v-model="detailVisible" :title="detailTitle" :size="isMobile ? '90%' : '60%'">
        <pre class="log-detail">{{ detailLog?.message }}</pre>
    </el-drawer>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps<{
    dataList: Array<{ no: number; message: string }>
}>()

const size = ref(10)
const sizes = ref([10, 20, 50, 100, 200, 300, 400, 500, 1000, 5000])
const current = ref(1)
const layout = ref('')

const isMobile = ref(/mobile/i.test(navigator.userAgent))
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
    if (isMobile.value) {
        layout.value = 'prev, next, sizes, ->, slot'
    } else {
        layout.value = 'prev, pager, next, jumper, sizes, ->, total'
    }
})

const pageCurrentChange = (size: number) => {
    current.value = size
}

const pageSizeChange = (sizes: number) => {
    size.value = sizes
    current.value = 1
}
</script>
<style scoped src="../assets/game-req.scss"></style>
<style scoped lang="scss">
.pagePaginationMobile {
    :deep() {
        .el-pagination__sizes {
            margin-left: 5px;
        }
    }
}

.log-summary {
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
}

.log-detail {
    margin: 0;
    font-family: inherit;
    line-height: 1.6;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}
</style>
