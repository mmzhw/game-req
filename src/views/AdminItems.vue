<template>
    <section class="admin-page">
        <div class="page-head">
            <div><h1>游戏控制台</h1><p>管理游戏、发送配置和物品数据。</p></div>
            <el-button type="primary" :icon="Plus" @click="openGame()">新增游戏</el-button>
        </div>
        <input ref="picker" class="file-input" type="file" accept=".txt,.text,.json" @change="chooseFile" />
        <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
        <el-table :data="rows" empty-text="暂无游戏" style="width: 100%" v-loading="busy">
            <el-table-column label="游戏" prop="name" min-width="130" />
            <el-table-column label="标识" prop="key" min-width="100" />
            <el-table-column label="功能数" width="90"><template #default="{ row }">{{ row.config.operations.length }}</template></el-table-column>
            <el-table-column label="物品数" prop="count" width="90"><template #default="{ row }">{{ row.count ?? 0 }}</template></el-table-column>
            <el-table-column label="物品文件" prop="source" min-width="130" show-overflow-tooltip><template #default="{ row }">{{ row.source || '未导入' }}</template></el-table-column>
            <el-table-column label="状态" width="80"><template #default="{ row }"><el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '启用' : '停用' }}</el-tag></template></el-table-column>
            <el-table-column label="操作" min-width="330" fixed="right">
                <template #default="{ row }">
                    <el-button link type="primary" :icon="Upload" @click="openImport(row.key)">导入物品</el-button>
                    <el-button link type="primary" :icon="Edit" :disabled="!row.count" @click="router.push(`/games/${row.key}/items`)">编辑物品</el-button>
                    <el-button link type="primary" :icon="Setting" @click="openGame(row)">编辑游戏</el-button>
                    <el-button link type="danger" :icon="Delete" @click="removeGame(row)">删除</el-button>
                </template>
            </el-table-column>
        </el-table>

        <el-dialog v-model="showGame" :title="editingKey ? '编辑游戏' : '新增游戏'" width="min(680px, 96vw)" :close-on-click-modal="!saving">
            <el-form label-position="top">
                <div class="form-grid">
                    <el-form-item label="游戏名称"><el-input v-model="form.name" maxlength="40" /></el-form-item>
                    <el-form-item label="游戏标识"><el-input v-model="form.key" :disabled="!!editingKey" placeholder="例如 new_game" /></el-form-item>
                    <el-form-item label="菜单排序"><el-input-number v-model="form.sortOrder" :min="0" :max="9999" /></el-form-item>
                    <el-form-item label="默认账号"><el-input v-model="form.config.defaultAccount" /></el-form-item>
                    <el-form-item label="默认数量"><el-input-number v-model="form.config.defaultNumber" :min="1" /></el-form-item>
                    <el-form-item label="默认发送间隔">
                        <el-input-number v-model="form.config.defaultInterval" :min="0" :max="60" :step="0.5" :precision="1" />
                        <span class="input-unit">秒</span>
                    </el-form-item>
                    <el-form-item label="菜单状态"><el-switch v-model="form.enabled" active-text="启用" inactive-text="停用" /></el-form-item>
                </div>
                <div class="operations-head">
                    <div><h3>功能配置</h3><p>可添加任意数量、不同地址和不同参数的功能。</p></div>
                    <el-button :icon="Plus" @click="addOperation">添加功能</el-button>
                </div>
                <div v-for="(operation, index) in form.config.operations" :key="index" class="operation-item">
                    <div class="operation-title"><strong>功能 {{ index + 1 }}</strong><el-button link type="danger" :icon="Delete" @click="form.config.operations.splice(index, 1)">移除</el-button></div>
                    <div class="form-grid">
                        <el-form-item label="功能名称"><el-input v-model="operation.name" placeholder="例如清空邮箱" /></el-form-item>
                        <el-form-item label="执行类型">
                            <el-select v-model="operation.mode">
                                <el-option label="逐个物品执行" value="item" />
                                <el-option label="批量物品执行" value="batch" />
                                <el-option label="无需物品的命令" value="command" />
                            </el-select>
                        </el-form-item>
                        <el-form-item label="请求方法"><el-select v-model="operation.method"><el-option label="POST" value="POST" /><el-option label="GET" value="GET" /></el-select></el-form-item>
                        <el-form-item class="wide" label="请求地址"><el-input v-model="operation.url" placeholder="http://..." /></el-form-item>
                        <el-form-item v-if="operation.mode === 'batch'" label="单次批量上限"><el-input-number v-model="operation.batchLimit" :min="1" :max="100" /></el-form-item>
                        <el-form-item v-if="operation.mode === 'batch'" label="批量参数格式">
                            <el-select v-model="operation.batchEncoding">
                                <el-option label="JSON 字符串" value="string" />
                                <el-option label="JSON 数组" value="json" />
                            </el-select>
                        </el-form-item>
                        <el-form-item v-if="operation.mode === 'batch'" class="wide" label="单条物品结构 JSON">
                            <el-input v-model="operation.batchItem" type="textarea" :rows="5" placeholder='{"id":"{{item.value}}","num":"{{number}}"}' />
                            <div class="field-help">可以自由使用字段名，例如 name/value、label/id，也可加入数量字段。</div>
                        </el-form-item>
                        <el-form-item label="会话绑定"><el-checkbox v-model="operation.useSession">需要先获取会话 Cookie</el-checkbox></el-form-item>
                        <el-form-item v-if="operation.useSession" class="wide" label="会话绑定地址"><el-input v-model="operation.session.resolveUrl" placeholder="http://.../resolve.php" /></el-form-item>
                        <el-form-item class="wide" label="请求参数 JSON">
                            <el-input v-model="operation.params" type="textarea" :rows="7" placeholder='{"uid":"{{account}}","itemid":"{{item.value}}","itemnum":"{{number}}"}' />
                            <div class="field-help">{{ placeholderHelp }}</div>
                        </el-form-item>
                    </div>
                </div>
            </el-form>
            <template #footer>
                <el-button :disabled="saving" @click="showGame = false">取消</el-button>
                <el-button type="primary" :loading="saving" @click="saveGame">保存</el-button>
            </template>
        </el-dialog>

        <el-dialog v-model="showImport" title="导入物品" width="min(720px, 96vw)" :close-on-click-modal="!saving">
            <el-tabs v-model="importMode">
                <el-tab-pane label="文件导入" name="file">
                    <div class="import-file">
                        <p>选择 UTF-8 编码的 TXT、TEXT 或 JSON 文件，文件内容须为标准物品数组。</p>
                        <el-button type="primary" :icon="Upload" @click="picker?.click()">选择文件</el-button>
                    </div>
                </el-tab-pane>
                <el-tab-pane label="粘贴 JSON" name="paste">
                    <el-form label-position="top">
                        <el-form-item label="JSON 内容">
                            <el-input v-model="pasteContent" type="textarea" :rows="10" placeholder='可以粘贴 JSON 数组、JSON 对象或经过 JSON.stringify 的字符串' />
                        </el-form-item>
                        <div class="form-grid">
                            <el-form-item class="wide" label="列表路径">
                                <el-input v-model="mapping.listPath" placeholder="根节点就是数组时留空；例如 data.items" />
                            </el-form-item>
                            <el-form-item label="物品名称字段"><el-input v-model="mapping.namePath" placeholder="例如 xxx、label 或 info.name" /></el-form-item>
                            <el-form-item label="物品 ID 字段"><el-input v-model="mapping.valuePath" placeholder="例如 yyy、id 或 info.code" /></el-form-item>
                            <el-form-item label="Action 来源">
                                <el-select v-model="mapping.actionMode">
                                    <el-option label="使用固定值" value="fixed" />
                                    <el-option label="读取字段" value="field" />
                                </el-select>
                            </el-form-item>
                            <el-form-item v-if="mapping.actionMode === 'fixed'" label="Action 固定值"><el-input v-model="mapping.actionValue" placeholder="例如 mail；不需要时可留空" /></el-form-item>
                            <el-form-item v-else label="Action 字段"><el-input v-model="mapping.actionPath" placeholder="例如 action 或 meta.action" /></el-form-item>
                        </div>
                    </el-form>
                </el-tab-pane>
            </el-tabs>
            <template #footer>
                <el-button :disabled="saving" @click="showImport = false">取消</el-button>
                <el-button v-if="importMode === 'paste'" type="primary" :loading="saving" @click="previewPaste">预览转换结果</el-button>
            </template>
        </el-dialog>

        <el-dialog v-model="showPreview" title="导入预览" width="min(540px, 94vw)" :close-on-click-modal="!saving">
            <template v-if="preview">
                <p class="source">{{ source }}</p>
                <dl>
                    <dt>游戏</dt><dd>{{ rows.find((row) => row.key === importGame)?.name }}</dd>
                    <dt>物品数</dt><dd>{{ preview.count }}</dd>
                    <dt>重复编号 / 同名</dt><dd>{{ preview.duplicateValues }} 组 / {{ preview.duplicateNames }} 组</dd>
                    <template v-if="preview.unnamed"><dt>空名称</dt><dd>{{ preview.unnamed }} 条</dd></template>
                    <dt>动作</dt><dd>{{ Object.entries(preview.actions).map(([action, count]) => `${action} · ${count}`).join('、') }}</dd>
                </dl>
                <el-table :data="preview.sample" size="small" max-height="180">
                    <el-table-column label="名称" prop="name" min-width="140" show-overflow-tooltip />
                    <el-table-column label="ID" prop="value" min-width="100" show-overflow-tooltip />
                    <el-table-column label="Action" prop="action" min-width="100" show-overflow-tooltip />
                </el-table>
                <el-alert v-if="preview.invalid" :title="`有 ${preview.invalid} 条无效记录：第 ${preview.issues.join('、')} 项`" type="error" :closable="false" />
            </template>
            <template #footer>
                <el-button :disabled="saving" @click="showPreview = false">取消</el-button>
                <el-button type="primary" :disabled="!preview || preview.invalid > 0" :loading="saving" @click="commitImport">导入并替换</el-button>
            </template>
        </el-dialog>
    </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Delete, Edit, Plus, Setting, Upload } from '@element-plus/icons-vue'
import { adminRequest, notifyGamesChanged } from '@/utils/admin-api'
import type { GameRecord } from '@/utils/game-templates'

type Catalog = { game: string; source: string; count: number; importedAt: string }
type Preview = { count: number; invalid: number; issues: number[]; unnamed: number; duplicateValues: number; duplicateNames: number; actions: Record<string, number>; sample: Array<{ name: string; value: string | number; action: string }>; sha256: string }
type ImportMapping = { listPath: string; namePath: string; valuePath: string; actionMode: 'fixed' | 'field'; actionPath: string; actionValue: string }
const router = useRouter()
const games = ref<GameRecord[]>([])
const catalogs = ref<Catalog[]>([])
const busy = ref(false)
const saving = ref(false)
const error = ref('')
const picker = ref<HTMLInputElement | null>(null)
const importGame = ref('')
const source = ref('')
const preview = ref<Preview | null>(null)
const showImport = ref(false)
const showPreview = ref(false)
const showGame = ref(false)
const editingKey = ref('')
let importContent = ''
let importMapping: ImportMapping | null = null
const importMode = ref<'file' | 'paste'>('file')
const pasteContent = ref('')
const mapping = reactive<ImportMapping>({ listPath: '', namePath: 'name', valuePath: 'value', actionMode: 'fixed', actionPath: 'action', actionValue: 'mail' })
const emptyForm = () => ({ key: '', name: '', enabled: true, sortOrder: 100, config: { defaultAccount: '', defaultNumber: 1, defaultInterval: 2.5, operations: [] as any[] } })
const form = reactive<any>(emptyForm())
const rows = computed(() => games.value.map((game) => ({ ...game, ...catalogs.value.find((catalog) => catalog.game === game.key) })))
const placeholderHelp = '占位符：{{account}}、{{number}}、{{item.value}}、{{item.name}}、{{item.action}}、{{items}}'

async function reload() {
    busy.value = true
    error.value = ''
    try {
        ;[games.value, catalogs.value] = await Promise.all([adminRequest<GameRecord[]>('/api/games'), adminRequest<Catalog[]>('/api/items/catalogs')])
    } catch (reason) {
        error.value = (reason as Error).message
    } finally {
        busy.value = false
    }
}
function openGame(game?: GameRecord) {
    Object.assign(form, emptyForm())
    if (game) {
        editingKey.value = game.key
        const copy = JSON.parse(JSON.stringify(game))
        copy.config.defaultInterval = Number(copy.config.defaultInterval ?? 2.5)
        copy.config.operations = (copy.config.operations || []).map((operation: any) => ({
            ...operation,
            useSession: !!operation.session?.resolveUrl,
            session: operation.session || { resolveUrl: '' },
            params: JSON.stringify(operation.params, null, 2),
            batchItem: JSON.stringify(operation.batchItem || { id: '{{item.value}}', num: '{{number}}' }, null, 2),
            batchEncoding: operation.batchEncoding || 'string'
        }))
        Object.assign(form, copy)
    } else {
        editingKey.value = ''
        form.sortOrder = (games.value.at(-1)?.sortOrder || 0) + 10
    }
    showGame.value = true
}
function addOperation() {
    form.config.operations.push({
        name: '',
        mode: 'item',
        method: 'POST',
        url: '',
        batchLimit: 5,
        batchEncoding: 'string',
        batchItem: '{\n  "id": "{{item.value}}",\n  "num": "{{number}}"\n}',
        useSession: false,
        session: { resolveUrl: '' },
        params: '{\n  "uid": "{{account}}",\n  "itemid": "{{item.value}}",\n  "itemnum": "{{number}}"\n}'
    })
}
async function saveGame() {
    saving.value = true
    try {
        const payload = JSON.parse(JSON.stringify(form))
        payload.config.operations = payload.config.operations.map((operation: any) => ({
            ...operation,
            session: operation.useSession ? operation.session : undefined,
            useSession: undefined
        }))
        await adminRequest(editingKey.value ? `/api/games/${editingKey.value}` : '/api/games', payload)
        showGame.value = false
        ElMessage.success(editingKey.value ? '游戏已更新' : '游戏已新增')
        notifyGamesChanged()
        await reload()
    } catch (reason) {
        ElMessage.error((reason as Error).message)
    } finally {
        saving.value = false
    }
}
async function removeGame(game: GameRecord) {
    const confirmed = await ElMessageBox.prompt(`永久删除“${game.name}”及其全部物品数据。请输入游戏名称确认。`, '删除游戏', { confirmButtonText: '删除', cancelButtonText: '取消', inputPlaceholder: game.name, inputValidator: (value) => value === game.name || '名称不一致' }).catch(() => null)
    if (!confirmed) return
    await adminRequest(`/api/games/${game.key}/delete`, {})
    notifyGamesChanged()
    ElMessage.success('游戏已删除')
    await reload()
}
function openImport(game: string) {
    importGame.value = game
    importMode.value = 'file'
    pasteContent.value = ''
    Object.assign(mapping, { listPath: '', namePath: 'name', valuePath: 'value', actionMode: 'fixed', actionPath: 'action', actionValue: 'mail' })
    showImport.value = true
}
async function chooseFile(event: Event) {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]
    input.value = ''
    if (!file) return
    try {
        if (file.size > 2 * 1024 * 1024 || !/\.(txt|text|json)$/i.test(file.name)) throw new Error('请选择不超过 2 MB 的 TXT、TEXT 或 JSON 文件')
        importContent = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer())
        importMapping = null
        preview.value = await adminRequest<Preview>(`/api/items/${importGame.value}/import/preview`, { text: importContent })
        source.value = file.name
        showImport.value = false
        showPreview.value = true
    } catch (reason) {
        ElMessage.error((reason as Error).message)
    }
}
async function previewPaste() {
    saving.value = true
    try {
        importContent = pasteContent.value
        importMapping = JSON.parse(JSON.stringify(mapping))
        preview.value = await adminRequest<Preview>(`/api/items/${importGame.value}/import/preview`, { text: importContent, mapping: importMapping })
        source.value = `粘贴导入-${new Date().toISOString().slice(0, 10)}.json`
        showImport.value = false
        showPreview.value = true
    } catch (reason) {
        ElMessage.error((reason as Error).message)
    } finally {
        saving.value = false
    }
}
async function commitImport() {
    if (!preview.value) return
    saving.value = true
    try {
        await adminRequest(`/api/items/${importGame.value}/import/confirm`, {
            text: importContent,
            source: source.value,
            sha256: preview.value.sha256,
            mapping: importMapping
        })
        showPreview.value = false
        ElMessage.success('物品已导入')
        await reload()
    } catch (reason) {
        ElMessage.error((reason as Error).message)
    } finally {
        saving.value = false
    }
}
onMounted(reload)
</script>

<style scoped>
.admin-page { padding: 24px; }
.page-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 18px; }
h1 { font-size: 23px; font-weight: 650; margin: 0; }
.page-head p { margin: 5px 0 0; color: #64736e; }
.file-input { display: none; }
.import-file { padding: 20px 4px 28px; text-align: center; }
.import-file p { margin: 0 0 16px; color: #64736e; }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0 16px; }
.form-grid .wide { grid-column: 1 / -1; }
.form-grid :deep(.el-select), .form-grid :deep(.el-input-number) { width: 100%; }
.input-unit { margin-left: 8px; color: #64736e; line-height: 32px; }
.source { font-weight: 650; overflow-wrap: anywhere; }
.operations-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin: 8px 0 12px; padding-top: 14px; border-top: 1px solid #e3e8e6; }
.operations-head h3 { margin: 0; font-size: 16px; }
.operations-head p { margin: 4px 0 0; color: #64736e; font-size: 13px; }
.operation-item { padding: 12px; margin-bottom: 12px; border: 1px solid #dfe6e3; border-radius: 6px; }
.operation-title { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.field-help { margin-top: 5px; color: #6b7974; font-size: 12px; overflow-wrap: anywhere; }
dl { display: grid; grid-template-columns: 108px minmax(0, 1fr); gap: 8px; }
dt { color: #5e6e68; }
dd { margin: 0; overflow-wrap: anywhere; }
@media (max-width: 700px) { .admin-page { padding: 16px; } .form-grid { grid-template-columns: 1fr; } .form-grid .wide { grid-column: auto; } }
</style>
