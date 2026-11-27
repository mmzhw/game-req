<template>
    <section class="items-page">
        <div class="page-head">
            <div>
                <el-button link :icon="ArrowLeft" @click="router.push('/games')">返回控制台</el-button>
            </div>
            <el-button type="primary" :icon="Plus" @click="openItem()">新增物品</el-button>
        </div>
        <div class="toolbar">
            <el-input v-model="keyword" clearable placeholder="搜索物品名称" @input="searchLater" />
            <span>共 {{ total }} 条</span>
        </div>
        <el-table class="items-table" :data="items" v-loading="busy" empty-text="暂无物品" style="width: 100%">
            <el-table-column label="名称" prop="name" min-width="180" show-overflow-tooltip />
            <el-table-column label="编号" prop="value" min-width="140" show-overflow-tooltip />
            <el-table-column label="动作" prop="action" width="150" />
            <el-table-column label="操作" width="150" fixed="right">
                <template #default="{ row }">
                    <el-button link type="primary" :icon="Edit" @click="openItem(row)">编辑</el-button>
                    <el-button link type="danger" :icon="Delete" @click="removeItem(row)">删除</el-button>
                </template>
            </el-table-column>
        </el-table>
        <el-pagination v-model:current-page="page" v-model:page-size="pageSize" :total="total" :page-sizes="[20, 50, 100, 200]" layout="total, sizes, prev, pager, next" @current-change="load" @size-change="load(1)" />

        <ScrollDialog v-model="showItem" :title="form.position === null ? '新增物品' : '编辑物品'" width="min(520px, 94vw)">
            <el-form label-position="top">
                <el-form-item label="物品名称"><el-input v-model="form.name" maxlength="512" /></el-form-item>
                <el-form-item label="物品编号"><el-input v-model="form.value" maxlength="128" /></el-form-item>
                <el-form-item label="动作类型"><el-select v-model="form.action"><el-option v-for="action in actions" :key="action" :label="action" :value="action" /></el-select></el-form-item>
            </el-form>
            <template #footer>
                <el-button :disabled="saving" @click="showItem = false">取消</el-button>
                <el-button type="primary" :loading="saving" @click="saveItem">保存</el-button>
            </template>
        </ScrollDialog>
    </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Delete, Edit, Plus } from '@element-plus/icons-vue'
import ScrollDialog from '@/components/ScrollDialog.vue'
import { adminRequest } from '@/utils/admin-api'
import type { GameRecord } from '@/utils/game-templates'

type Item = { _position: number; name: string; value: string | number; action: string; [key: string]: unknown }
const route = useRoute()
const router = useRouter()
const gameKey = String(route.params.id)
const game = ref<GameRecord | null>(null)
const items = ref<Item[]>([])
const keyword = ref('')
const page = ref(1)
const pageSize = ref(50)
const total = ref(0)
const busy = ref(false)
const saving = ref(false)
const showItem = ref(false)
const actions = ['mail', 'mail2', 'sendmoney', 'senditems_batch']
const form = reactive<{ position: number | null; name: string; value: string; action: string }>({ position: null, name: '', value: '', action: 'mail' })
let searchTimer = 0

async function load(targetPage = page.value) {
    busy.value = true
    try {
        const params = new URLSearchParams({ keyword: keyword.value, page: String(targetPage), pageSize: String(pageSize.value) })
        const result = await adminRequest<{ list: Item[]; total: number; page: number }>(`/api/items/${encodeURIComponent(gameKey)}?${params}`)
        items.value = result.list
        total.value = result.total
        page.value = result.page
    } catch (reason) {
        ElMessage.error((reason as Error).message)
    } finally {
        busy.value = false
    }
}
function searchLater() {
    window.clearTimeout(searchTimer)
    searchTimer = window.setTimeout(() => load(1), 250)
}
function openItem(item?: Item) {
    form.position = item?._position ?? null
    form.name = item?.name || ''
    form.value = item ? String(item.value) : ''
    form.action = item?.action || 'mail'
    showItem.value = true
}
async function saveItem() {
    saving.value = true
    try {
        await adminRequest(`/api/items/${encodeURIComponent(gameKey)}/item`, { position: form.position, item: { name: form.name, value: form.value, action: form.action } })
        showItem.value = false
        ElMessage.success(form.position === null ? '物品已新增' : '物品已更新')
        await load()
    } catch (reason) {
        ElMessage.error((reason as Error).message)
    } finally {
        saving.value = false
    }
}
async function removeItem(item: Item) {
    const confirmed = await ElMessageBox.confirm(`删除物品“${item.name}”？`, '删除物品', { type: 'warning' }).catch(() => false)
    if (!confirmed) return
    await adminRequest(`/api/items/${encodeURIComponent(gameKey)}/item/delete`, { position: item._position })
    ElMessage.success('物品已删除')
    await load()
}
onMounted(async () => {
    game.value = await adminRequest<GameRecord>(`/api/games/${encodeURIComponent(gameKey)}`)
    await load()
})
</script>

<style scoped>
.items-page {
    min-width: 0;
    color: var(--ui-text);
}
.page-head,
.toolbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 10px 16px;
}
.page-head {
    align-items: flex-end;
    margin-bottom: 18px;
}
.page-head > div {
    min-width: 0;
}
.toolbar {
    margin-bottom: 12px;
    color: var(--ui-muted);
    font-size: 13px;
}
.toolbar .el-input {
    flex: 0 1 320px;
    width: 320px;
    max-width: 100%;
}
.items-table {
    max-width: 100%;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius);
}
.el-pagination {
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px 4px;
    margin-top: 14px;
}
.el-select {
    width: 100%;
}
@media (max-width: 900px) {
    .items-table :deep(.el-table-fixed-column--right) {
        position: relative !important;
        right: auto !important;
        z-index: var(--el-table-index);
    }
    .items-table :deep(.el-table-fixed-column--right::before) {
        content: none;
    }
}
@media (max-width: 600px) {
    .toolbar .el-input {
        flex: 1 1 180px;
    }
    .el-pagination {
        justify-content: flex-start;
    }
    .el-pagination :deep(.el-pager li) {
        min-width: 24px;
    }
}
</style>
