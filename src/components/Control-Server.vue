<template>
    <div class="update-actions">
        <el-button :icon="Upload" @click="open('frontend')">前端更新 {{ version }}</el-button>
        <el-button :icon="Box" @click="open('server')">服务端更新</el-button>
        <el-button :icon="RefreshRight" @click="open('restart')">重启服务</el-button>
    </div>

    <el-dialog v-model="visible" :title="title" width="min(500px, 94vw)" :close-on-click-modal="!busy" :close-on-press-escape="!busy" :show-close="!busy" @closed="clear">
        <el-form v-if="!job" label-position="top" @submit.prevent="submit">
            <el-form-item v-if="kind !== 'restart'" label="更新包">
                <input ref="fileInput" type="file" accept=".zip" class="file-input" :disabled="busy" @change="selectFile" />
                <el-button :icon="FolderOpened" :disabled="busy" @click="fileInput?.click()">选择 {{ kind === 'frontend' ? 'dist.zip' : 'release.zip' }}</el-button>
                <span v-if="file" class="filename">{{ file.name }}</span>
            </el-form-item>
            <el-form-item label="管理员口令">
                <el-input v-model="token" type="password" autocomplete="off" show-password :disabled="busy || !configured" />
            </el-form-item>
        </el-form>
        <el-alert v-if="message" :title="message" :type="resultType" :closable="false" show-icon />
        <template #footer>
            <el-button :disabled="busy" @click="visible = false">关闭</el-button>
            <el-button v-if="!job" type="primary" :loading="busy || checking" :disabled="!configured || !token || (kind !== 'restart' && !file)" @click="submit">{{ kind === 'restart' ? '确认重启' : '开始更新' }}</el-button>
            <el-button v-else-if="job.phase === 'success'" type="primary" @click="reloadPage">刷新页面</el-button>
        </template>
    </el-dialog>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'
import { Box, FolderOpened, RefreshRight, Upload } from '@element-plus/icons-vue'
import axios from 'axios'

declare const __Admin_VERSION__: string
type Kind = 'frontend' | 'server' | 'restart'
type Job = { id: string; phase: string; message: string }
const emit = defineEmits<{ (event: 'uploadSuccess' | 'uploadError', message: string): void }>()
const version = __Admin_VERSION__
const base = import.meta.env.DEV ? 'http://localhost:3000' : ''
const visible = ref(false)
const busy = ref(false)
const checking = ref(false)
const configured = ref(false)
let statusCheck = 0
const kind = ref<Kind>('frontend')
const token = ref('')
const file = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const job = ref<Job | null>(null)
const message = ref('')
const resultType = ref<'info' | 'success' | 'error'>('info')
const title = computed(() => ({ frontend: '前端更新', server: '服务端更新', restart: '重启服务' })[kind.value])
const terminal = new Set(['success', 'failed', 'rollback_failed'])

function clear() {
    statusCheck++
    checking.value = false
    configured.value = false
    token.value = ''
    file.value = null
    if (fileInput.value) fileInput.value.value = ''
    job.value = null
    message.value = ''
    resultType.value = 'info'
}
async function open(value: Kind) {
    clear()
    kind.value = value
    visible.value = true
    checking.value = true
    const current = ++statusCheck
    try {
        const { data } = await axios.get<{ enabled: boolean }>(base + '/api/update/status', { timeout: 5000 })
        if (statusCheck !== current || !visible.value) return
        configured.value = data.enabled === true
        if (!configured.value) message.value = '页面更新未开启：请检查 Docker 环境变量 GAME_REQ_UPDATE_TOKEN 是否已填写。'
    } catch {
        if (statusCheck !== current || !visible.value) return
        resultType.value = 'error'
        message.value = '无法读取更新状态，请确认服务正常运行。'
    } finally {
        if (statusCheck === current) checking.value = false
    }
}
function selectFile(event: Event) {
    file.value = (event.target as HTMLInputElement).files?.[0] ?? null
}
function reloadPage() {
    window.location.reload()
}
function statusMessage(error: unknown) {
    if (!axios.isAxiosError(error)) return '无法提交更新，请检查服务状态'
    const response = error.response
    if (response?.status === 401) return '管理员口令不正确'
    if (response?.status === 503) return typeof response.data === 'string' ? response.data : response.data?.message || '页面更新未开启'
    if (response?.status === 413) return '更新包过大（上限 32 MB）'
    return response?.data?.message || (typeof response?.data === 'string' ? response.data : '服务器未响应，请检查服务状态')
}
async function submit() {
    if (busy.value || !configured.value || !token.value || (kind.value !== 'restart' && !file.value)) return
    busy.value = true
    resultType.value = 'info'
    message.value = kind.value === 'restart' ? '正在提交重启' : '正在上传并校验更新包'
    const bytes = new TextEncoder().encode(token.value)
    const headers = { Authorization: 'GameReq ' + btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join('')) }
    try {
        const data = new FormData()
        if (file.value) data.append('file', file.value)
        const route = { frontend: '/upload', server: '/uploadServer', restart: '/restart' }[kind.value]
        const response = await axios.post(base + route, kind.value === 'restart' ? {} : data, { headers, timeout: 120000 })
        if (kind.value === 'restart') {
            message.value = response.data.message
            resultType.value = 'success'
            emit('uploadSuccess', message.value)
            return
        }
        if (!/^[a-f0-9]{32}$/.test(response.data?.id || '')) throw new Error('missing job id')
        job.value = response.data
        message.value = response.data.message
        const deadline = Date.now() + 380000
        while (Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, 1800))
            const status = await axios.get<Job>(base + '/api/update/jobs/' + response.data.id, { headers, timeout: 4000 }).catch(() => null)
            if (!status) continue
            job.value = status.data
            message.value = status.data.message
            if (!terminal.has(status.data.phase)) continue
            const success = status.data.phase === 'success'
            resultType.value = success ? 'success' : 'error'
            emit(success ? 'uploadSuccess' : 'uploadError', title.value + '：' + message.value)
            return
        }
        message.value = '暂未确认更新结果，请查看容器日志，不要重复上传。更新编号：' + response.data.id
        resultType.value = 'error'
        emit('uploadError', message.value)
    } catch (error) {
        message.value = statusMessage(error)
        resultType.value = 'error'
        emit('uploadError', title.value + '：' + message.value)
    } finally {
        token.value = ''
        busy.value = false
    }
}
</script>

<style scoped>
.update-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}
.update-actions .el-button {
    margin: 0;
}
.file-input {
    display: none;
}
.filename {
    margin-left: 10px;
    overflow-wrap: anywhere;
    color: var(--el-text-color-secondary);
}
</style>
