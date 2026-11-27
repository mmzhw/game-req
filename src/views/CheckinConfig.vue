<template>
    <main class="checkin-page" v-loading="loading">
        <header class="page-header">
            <p>服务端定时执行，配置完成后无需打开浏览器。</p>
            <el-button @click="refresh()" :loading="refreshing">刷新状态</el-button>
        </header>

        <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon class="page-alert" />

        <section class="overview" v-if="state">
            <div class="summary-item">
                <span class="summary-label">自动签到</span>
                <strong><i :class="['status-dot', { active: state.config.enabled }]" />{{ state.config.enabled ? '已开启' : '未开启' }}</strong>
                <small>北京时间 · {{ state.config.scheduleMode === 'random' ? `每日随机 ${state.config.randomStart}–${state.config.randomEnd}` : `每天 ${state.config.time}` }}</small>
            </div>
            <div class="summary-item">
                <span class="summary-label">下次执行</span>
                <strong>{{ state.runtime.running ? '正在执行' : formatTime(state.runtime.nextRunAt) }}</strong>
                <small>{{ state.runtime.nextIsRetry ? '上次未提交，在整点重试' : state.runtime.nextRunAt ? '由后台服务自动触发' : '保存配置并开启后开始计时' }}</small>
            </div>
            <div class="summary-item">
                <span class="summary-label">最近结果</span>
                <strong>{{ latest ? statusLabel(latest.status) : '暂无记录' }}</strong>
                <small>{{ latest ? formatTime(latest.finishedAt || latest.startedAt) : '执行后将在这里显示' }}</small>
            </div>
        </section>

        <div class="page-columns">
            <el-card shadow="never" class="config-card">
                <template #header>
                    <div class="card-heading">
                        <div>
                            <h2>{{ siteName }}</h2>
                            <a :href="signPage" target="_blank" rel="noreferrer">打开站点 ↗</a>
                        </div>
                        <el-tag effect="plain">{{ isFnat && form.authMode === 'password' ? '账号密码登录' : 'Cookie 登录' }}</el-tag>
                    </div>
                </template>
                <el-form label-position="top" @submit.prevent="save">
                    <div class="form-row">
                        <el-form-item label="自动签到">
                            <el-switch v-model="form.enabled" active-text="开启" inactive-text="关闭" />
                        </el-form-item>
                        <el-form-item label="执行方式">
                            <el-radio-group v-model="form.scheduleMode">
                                <el-radio-button value="fixed">固定时间</el-radio-button>
                                <el-radio-button value="random">每日随机</el-radio-button>
                            </el-radio-group>
                        </el-form-item>
                    </div>
                    <el-form-item v-if="form.scheduleMode === 'fixed'" label="每日执行时间（北京时间）">
                        <el-time-picker v-model="form.time" format="HH:mm" value-format="HH:mm" :clearable="false" style="width: 100%" />
                    </el-form-item>
                    <div v-else class="form-row">
                        <el-form-item label="最早执行时间（北京时间）">
                            <el-time-picker v-model="form.randomStart" format="HH:mm" value-format="HH:mm" :clearable="false" style="width: 100%" />
                        </el-form-item>
                        <el-form-item label="最晚执行时间（北京时间）">
                            <el-time-picker v-model="form.randomEnd" format="HH:mm" value-format="HH:mm" :clearable="false" style="width: 100%" />
                        </el-form-item>
                    </div>
                    <el-form-item label="站点用户名">
                        <el-input v-model="form.account" :placeholder="isFnat && form.authMode === 'password' ? 'FNAT 登录用户名' : '需与 Cookie 对应的账号一致'" maxlength="64" />
                    </el-form-item>
                    <el-form-item v-if="isFnat" label="登录方式">
                        <el-radio-group v-model="form.authMode">
                            <el-radio-button value="cookie">Cookie / token</el-radio-button>
                            <el-radio-button value="password">账号密码</el-radio-button>
                        </el-radio-group>
                        <p class="field-help">两种方式可独立使用。账号密码模式无需预先配置 Cookie，首次执行时会自动登录并保存会话。</p>
                    </el-form-item>
                    <el-form-item v-if="!isFnat || form.authMode === 'cookie'">
                        <template #label>
                            <div class="cookie-label">
                                <span>Cookie <el-tag v-if="state?.config.hasCookie" size="small" type="success">已保存</el-tag></span>
                                <button type="button" class="cookie-button" :data-toggle="helperReady ? 'get-cookie' : undefined" :data-site="signPage" data-name="cookie" @click="requestCookie">从浏览器获取</button>
                            </div>
                        </template>
                        <el-input v-model="form.cookie" type="password" show-password autocomplete="off" :placeholder="state?.config.hasCookie ? '已保存登录信息，留空会保留；更新时重新获取或粘贴' : '从浏览器获取，或粘贴完整 Cookie'" />
                        <p class="field-help">先在同一浏览器登录{{ siteName }}，再获取 Cookie，最后点击“保存配置”。</p>
                        <el-button link type="primary" @click="helperDialog = true">获取插件没有反应？查看设置方法</el-button>
                        <p class="field-help" v-if="state?.config.credentialsUpdatedAt">上次更新：{{ formatTime(state.config.credentialsUpdatedAt) }}</p>
                    </el-form-item>
                    <template v-if="isFnat && form.authMode === 'password'">
                        <el-form-item label="FNAT 登录密码">
                            <el-input v-model="form.password" type="password" show-password autocomplete="new-password" :placeholder="state?.config.hasPassword ? '密码已保存，留空会保留' : '输入 FNAT 登录密码'" />
                            <p class="field-help">无需填写 Cookie；密码只保存在后台签到数据目录，状态接口和执行记录不会返回原文。</p>
                        </el-form-item>
                        <el-alert title="FNAT 当前会把 HTTPS 登录地址重定向到 HTTP，自动登录时账号密码可能以明文经过网络。" type="warning" :closable="false" show-icon class="login-warning" />
                        <el-checkbox v-model="form.allowInsecureLogin" class="risk-confirm">我确认并允许通过 FNAT 当前的 HTTP 登录入口自动登录</el-checkbox>
                    </template>
                    <el-collapse class="advanced-settings">
                        <el-collapse-item title="网络与首次配置" name="network">
                            <el-form-item label="代理地址（留空直连）">
                                <el-input v-model="form.proxy" placeholder="例如 http://192.168.0.150:7890" />
                            </el-form-item>
                            <el-form-item v-if="!isFnat" label="站点浏览器标识">
                                <el-input v-model="form.fingerprint" type="password" show-password :placeholder="state?.config.hasFingerprint ? '已保存，日常更新 Cookie 无需修改' : '首次配置时填写站点标识'" />
                                <p class="field-help">首次验证时已保存；更新 Cookie 时会继续保留。</p>
                            </el-form-item>
                        </el-collapse-item>
                    </el-collapse>
                    <div class="form-actions">
                        <el-button type="primary" :loading="saving" @click="save">保存配置</el-button>
                        <el-button :loading="inspecting" :disabled="!state?.config.credentialsReady || state?.runtime.running" @click="inspect">检查登录态</el-button>
                        <el-button :loading="running" :disabled="!state?.config.credentialsReady || state?.runtime.todayClaimed || state?.runtime.running || drawing" @click="run()">{{ state?.runtime.retryAvailable ? '立即重试' : '立即签到' }}</el-button>
                    </div>
                    <p class="field-help guard-note">{{ isFnat ? '每天最多执行一次；失败或结果不明时不自动重试。' : '每天最多提交一次；提交前失败可手动重试，自动签到开启时会在下一个整点重试。' }}检查登录态不会签到。</p>
                    <template v-if="isFnat && state?.lottery">
                        <el-divider />
                        <el-form-item label="自动免费抽奖（随签到计划执行）">
                            <el-switch v-model="form.lotteryEnabled" :disabled="!form.enabled" active-text="开启" inactive-text="关闭" />
                        </el-form-item>
                        <el-button :loading="drawing" :disabled="!state.config.credentialsReady || state.runtime.running || state.lottery.todayClaimed || running" @click="run(true)">立即免费抽奖</el-button>
                    </template>
                    <el-alert v-if="inspection" :type="inspection.signed ? 'success' : 'info'" :title="inspection.account + ' · ' + (inspection.signed ? '今日已签到' : '登录有效，今日尚未签到') + (inspection.counters ? ' · 累计 ' + inspection.counters.lxtdays + ' 天' : '')" :closable="false" show-icon />
                </el-form>
            </el-card>

            <el-card shadow="never" class="record-card">
                <template #header
                    ><div class="card-heading">
                        <h2>执行记录</h2>
                        <span class="subtle">最近 30 次</span>
                    </div></template
                >
                <el-empty v-if="!state?.records.length" description="暂无执行记录" :image-size="72" />
                <div v-for="record in state?.records" :key="record.date + record.account" class="run-record">
                    <div class="record-heading">
                        <strong>{{ record.date }}</strong>
                        <div class="record-actions">
                            <el-tag :type="statusType(record.status)" size="small">{{ statusLabel(record.status) }}</el-tag>
                            <el-button link type="primary" :icon="Tickets" @click="showRequest(record)">平台请求</el-button>
                        </div>
                    </div>
                    <p class="record-message">{{ record.message }}</p>
                    <div class="counters" v-if="record.after">
                        <span class="detail-label">站点回查</span>
                        <span
                            >累计 <b>{{ record.after.lxtdays }}</b> 天</span
                        ><span
                            >连续 <b>{{ record.after.lxdays }}</b> 天</span
                        ><span v-if="record.status === 'success'"
                            >奖励 <b>{{ record.after.lxreward }}</b></span
                        >
                    </div>
                    <p class="record-meta">{{ sourceLabel(record.source) }} · {{ formatTime(record.finishedAt || record.startedAt) }} · 签到提交 {{ record.checkinPosts }} 次</p>
                </div>
                <template v-if="isFnat && state?.lottery">
                    <el-divider />
                    <div class="card-heading">
                        <h2>免费抽奖记录</h2>
                        <span class="subtle">最近 30 次</span>
                    </div>
                    <el-empty v-if="!state.lottery.records.length" description="暂无抽奖记录" :image-size="72" />
                    <div v-for="record in state.lottery.records" :key="record.date + record.account" class="run-record">
                        <div class="record-heading">
                            <strong>{{ record.date }}</strong>
                            <div class="record-actions">
                                <el-tag :type="statusType(record.status)" size="small">{{ statusLabel(record.status) }}</el-tag>
                                <el-button link type="primary" :icon="Tickets" @click="showRequest(record, true)">平台请求</el-button>
                            </div>
                        </div>
                        <p class="record-message">{{ record.message }}</p>
                        <p class="record-meta">{{ sourceLabel(record.source) }} · {{ formatTime(record.finishedAt || record.startedAt) }} · 抽奖提交 {{ record.checkinPosts }} 次</p>
                    </div>
                </template>
            </el-card>
        </div>

        <footer>后台时间：{{ formatTime(state?.runtime.serverTime) }} · 时区 Asia/Shanghai <span>关闭本页面不影响后台执行</span></footer>

        <ScrollDialog v-model="inspectionDialog" title="登录态检查失败" width="min(560px, 94vw)">
            <div class="request-details"><pre>{{ inspectionFailure }}</pre></div>
            <textarea ref="inspectionCopyInput" class="diagnostic-copy-input" aria-hidden="true" tabindex="-1" />
            <template #footer>
                <el-button :icon="CopyDocument" @click="copyDiagnosticText(inspectionFailure, inspectionCopyInput)">复制诊断</el-button>
                <el-button type="primary" @click="inspectionDialog = false">关闭</el-button>
            </template>
        </ScrollDialog>

        <ScrollDialog v-model="requestDialog" title="平台请求" width="min(672px, 94vw)">
            <template v-if="selectedRecord">
                <p class="request-summary">{{ selectedRecord.date }} · {{ sourceLabel(selectedRecord.source) }} · {{ statusLabel(selectedRecord.status) }}</p>
                <div class="request-details">
                    <section v-for="section in diagnosticSections" :key="section.title">
                        <h3>{{ section.title }}</h3>
                        <pre>{{ section.text }}</pre>
                    </section>
                </div>
                <textarea ref="diagnosticCopyInput" class="diagnostic-copy-input" readonly tabindex="-1" aria-hidden="true" />
            </template>
            <template #footer>
                <el-button :icon="CopyDocument" @click="copyDiagnostics">复制诊断</el-button>
                <el-button type="primary" @click="requestDialog = false">关闭</el-button>
            </template>
        </ScrollDialog>

        <ScrollDialog v-model="helperDialog" title="使用现有获取 Cookie 插件" width="min(560px, 92vw)">
            <ol class="helper-steps">
                <li>在 Chrome 中右键你现有的“获取 Cookies”插件，打开“选项”。</li>
                <li>
                    在“需要加载插件的域名或 IP 地址”中另起一行，加入当前页面地址：<code>{{ localOrigin }}</code>
                </li>
                <li>保留原有地址，点击 Save，然后刷新本页面。</li>
                <li>在同一浏览器登录{{ siteName }}，再点击“从浏览器获取”，确认后保存配置。</li>
            </ol>
            <el-alert :title="helperReady ? '已检测到 Cookie 插件，可以获取' : '当前页面尚未检测到 Cookie 插件'" :type="helperReady ? 'success' : 'info'" :closable="false" show-icon />
            <template #footer><el-button type="primary" @click="helperDialog = false">知道了</el-button></template>
        </ScrollDialog>
    </main>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { CopyDocument, Tickets } from '@element-plus/icons-vue'
import ScrollDialog from '@/components/ScrollDialog.vue'
import { adminFetch } from '@/utils/admin-api'

type Counters = { lxtdays: number; lxdays: number; lxreward: number; lxlevel: number }
type PlatformRequest = { method: string; url: string; contentType: string; fields: string[] }
type ResponseBody = { bytes: number; kind: 'empty' | 'text' | 'omitted'; text?: string; truncated?: boolean }
type PlatformResponse = { status: number; location: string | null; contentType: string | null; body: ResponseBody }
type SubmissionTrace = { request: PlatformRequest; response?: PlatformResponse; error?: string }
type DiagnosticStep = { name: string; startedAt: string; durationMs: number; outcome: 'ok' | 'error'; httpStatus?: number; code?: string }
type RunRecord = { date: string; account: string; source: string; status: string; message: string; startedAt: string; finishedAt?: string; checkinPosts: number; responseStatus?: number | null; submissionTrace?: SubmissionTrace; code?: string; network?: 'direct' | 'proxy'; diagnostics?: DiagnosticStep[]; before?: Counters; after?: Counters }
type ScheduleMode = 'fixed' | 'random'
type AuthMode = 'cookie' | 'password'
type CheckinState = { config: { enabled: boolean; time: string; scheduleMode?: ScheduleMode; randomStart?: string; randomEnd?: string; account: string; authMode?: AuthMode; hasCookie: boolean; hasPassword?: boolean; allowInsecureLogin?: boolean; credentialsReady?: boolean; hasFingerprint: boolean; credentialsUpdatedAt?: string; proxy: string }; runtime: { running: boolean; serverTime: string; nextRunAt: string | null; todayClaimed: boolean; retryAvailable?: boolean; nextIsRetry?: boolean }; records: RunRecord[]; lottery?: { enabled: boolean; todayClaimed: boolean; records: RunRecord[] } }
const props = defineProps<{ provider?: 'fnat' }>()
const isFnat = computed(() => props.provider === 'fnat')
const siteName = computed(() => isFnat.value ? 'FNAT' : '老王论坛')
const signPage = computed(() => isFnat.value ? 'https://frp.fnat.cc/console/Sign' : 'https://laowang.vip/plugin.php?id=k_misign:sign')
const state = ref<CheckinState | null>(null)
const loading = ref(true),
    refreshing = ref(false),
    saving = ref(false),
    inspecting = ref(false),
    running = ref(false),
    drawing = ref(false)
const error = ref(''),
    helperDialog = ref(false),
    helperReady = ref(false)
const inspection = ref<{ account: string; signed: boolean; counters: Pick<Counters, 'lxtdays'> | null } | null>(null)
const requestDialog = ref(false)
const inspectionDialog = ref(false)
const inspectionFailure = ref('')
const inspectionCopyInput = ref<HTMLTextAreaElement | null>(null)
const selectedRecord = ref<RunRecord | null>(null)
const selectedAction = ref('签到')
const diagnosticCopyInput = ref<HTMLTextAreaElement | null>(null)
const localOrigin = window.location.origin
const form = reactive({ enabled: false, lotteryEnabled: false, time: '08:00', scheduleMode: 'fixed' as ScheduleMode, randomStart: '08:00', randomEnd: '10:00', account: 'mmzhw51', authMode: 'cookie' as AuthMode, cookie: '', password: '', allowInsecureLogin: false, proxy: '', fingerprint: '' })
const latest = computed(() => state.value?.records[0])
const diagnosticSections = computed(() => {
    const record = selectedRecord.value
    if (!record) return []
    const sections = [
        {
            title: '执行摘要',
            text: ['开始：' + formatTime(record.startedAt), '结束：' + formatTime(record.finishedAt), record.network && '网络：' + (record.network === 'proxy' ? '代理' : '直连'), selectedAction.value + '提交：' + record.checkinPosts + ' 次', record.code && '错误码：' + record.code, record.message].filter(Boolean).join('\n')
        }
    ]
    if (record.diagnostics?.length) sections.push({ title: '执行过程（北京时间）', text: record.diagnostics.map(formatStep).join('\n') })
    const trace = record.submissionTrace
    if (trace) {
        sections.push({ title: '发送的请求（脱敏）', text: formatRequest(trace.request) })
        sections.push({ title: '平台返回', text: trace.response ? formatResponse(trace.response) : trace.error || '未收到响应' })
        if (trace.response) sections.push({ title: selectedAction.value === '抽奖' ? '响应摘要（脱敏）' : '响应正文 · ' + trace.response.body.bytes + ' 字节', text: formatResponseBody(trace.response.body) })
    } else {
        const status = record.responseStatus != null ? '已记录状态：HTTP ' + record.responseStatus + '\n' : ''
        sections.push({ title: '平台请求详情', text: status + (record.checkinPosts ? '这条记录未保存请求地址、表单或响应正文。' : `没有记录到最终${selectedAction.value}提交。`) })
    }
    const after = record.after
    if (after) {
        const change = (key: keyof Counters) => (record.before && String(record.before[key]) !== String(after[key]) ? record.before[key] + ' → ' : '') + after[key]
        sections.push({ title: '站点回查', text: ['累计：' + change('lxtdays') + ' 天', '连续：' + change('lxdays') + ' 天', '站点奖励值：' + change('lxreward')].join('\n') })
    }
    return sections
})
let timer: ReturnType<typeof setInterval> | undefined
let awaitingCookieUntil = 0
async function api(route: string, body?: unknown, method = 'POST') {
    const response = await adminFetch('/api/checkin' + (isFnat.value ? '/fnat' : '') + route, { method: body === undefined && route === '' ? 'GET' : method, headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined, body: body === undefined ? undefined : JSON.stringify(body) })
    const value = await response.json()
    if (!response.ok) throw Object.assign(new Error(value.error || '请求失败，请确认后台服务已启动'), { code: value.code, diagnostic: value.diagnostic })
    return value
}
function formatTime(value?: string | null) {
    return value ? new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date(value)) : '—'
}
function statusLabel(status: string) {
    return ({ success: '签到成功', already_signed: '今日已签到', failed: '执行失败', unconfirmed: '结果待确认', running: '执行中 / 待确认' } as Record<string, string>)[status] || status
}
function statusType(status: string) {
    return status === 'success' || status === 'already_signed' ? 'success' : status === 'failed' ? 'danger' : 'warning'
}
function sourceLabel(source: string) {
    return ({ scheduled: '定时执行', manual: '手动执行', verified: '首次验证' } as Record<string, string>)[source] || source
}
function showRequest(record: RunRecord, draw = false) {
    selectedAction.value = draw ? '抽奖' : '签到'
    selectedRecord.value = record
    requestDialog.value = true
}
function formatRequest(request: PlatformRequest) {
    return [request.method + ' ' + request.url, 'Content-Type: ' + request.contentType, '', ...request.fields.map((field) => field + '=[已隐藏]')].join('\n').trimEnd()
}
function formatResponse(response: PlatformResponse) {
    return ['HTTP ' + response.status, response.location && 'Location: ' + response.location, response.contentType && 'Content-Type: ' + response.contentType].filter(Boolean).join('\n')
}
function formatResponseBody(body: ResponseBody) {
    if (body.kind === 'empty') return '（响应正文为空）'
    if (body.kind === 'omitted') return '（响应格式、大小或内容不适合记录，未保存正文）'
    return (body.text || '') + (body.truncated ? '\n…（预览已截断）' : '')
}
function formatStep(step: DiagnosticStep) {
    const names: Record<string, string> = { initial_state: '检查登录和签到状态', verification_page: '加载验证页面', verification_resources: '加载验证资源', verification_image: '加载验证图片', verification_check: '本地检查验证数据', verification_result: '站点验证', submit: '提交签到', readback: '回查签到状态' }
    return [formatTime(step.startedAt), names[step.name] || step.name, step.outcome === 'ok' ? '已完成' : '失败', step.httpStatus != null && 'HTTP ' + step.httpStatus, step.code, step.durationMs + ' ms'].filter(Boolean).join(' · ')
}
async function copyDiagnostics() {
    const record = selectedRecord.value
    if (!record) return
    const text = [siteName.value + ' · ' + record.date + ' · ' + sourceLabel(record.source) + ' · ' + statusLabel(record.status), ...diagnosticSections.value.map((section) => '[' + section.title + ']\n' + section.text)].join('\n\n')
    await copyDiagnosticText(text, diagnosticCopyInput.value)
}
async function copyDiagnosticText(text: string, input: HTMLTextAreaElement | null) {
    try {
        if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(text)
        } else {
            if (!input) throw new Error()
            input.value = text
            input.select()
            if (!document.execCommand('copy')) throw new Error()
        }
        ElMessage.success('诊断日志已复制')
    } catch {
        ElMessage.warning('无法访问剪贴板，可选中弹窗中的日志复制')
    }
}
async function refresh(initial = false, quiet = false) {
    if (!quiet) refreshing.value = true
    try {
        state.value = await api('')
        if (initial && state.value) {
            const { enabled, time, scheduleMode = 'fixed', randomStart = '08:00', randomEnd = '10:00', account, authMode = 'cookie', allowInsecureLogin = false, proxy } = state.value.config
            Object.assign(form, { enabled, time, scheduleMode, randomStart, randomEnd, account, authMode, allowInsecureLogin, proxy, lotteryEnabled: state.value.lottery?.enabled ?? false })
        }
        helperReady.value = document.body.getAttribute('get-cookie') === 'true'
        error.value = ''
    } catch (reason) {
        error.value = (reason as Error).message
    } finally {
        loading.value = false
        refreshing.value = false
    }
}
async function save() {
    saving.value = true
    try {
        const credentials = isFnat.value && form.authMode === 'password'
            ? { cookie: '', password: form.password }
            : { cookie: form.cookie, password: '' }
        state.value = await api('/config', { ...form, ...credentials, fingerprint: form.fingerprint || undefined }, 'PUT')
        form.lotteryEnabled = state.value?.lottery?.enabled ?? false
        form.cookie = ''
        form.password = ''
        form.fingerprint = ''
        inspection.value = null
        ElMessage.success('配置已保存')
    } catch (reason) {
        ElMessage.error((reason as Error).message)
    } finally {
        saving.value = false
    }
}
async function inspect() {
    inspecting.value = true
    try {
        inspection.value = await api('/inspect', {})
        ElMessage.success('已检查登录态，未提交签到')
    } catch (reason) {
        inspection.value = null
        const error = reason as Error & { code?: string; diagnostic?: { stage: string; durationMs: number; connection: string; upstreamStatus?: number; cfRay?: string; checkedAt: string } }
        const detail = error.diagnostic
        inspectionFailure.value = [
            `站点：${siteName.value}`,
            `错误：${error.message}`,
            error.code && `错误代码：${error.code}`,
            detail && `检查时间：${formatTime(detail.checkedAt)}（北京时间）`,
            detail && `失败阶段：${detail.stage}`,
            detail && `耗时：${detail.durationMs} ms`,
            detail && `连接方式：${detail.connection}`,
            detail?.upstreamStatus && `上游 HTTP 状态：${detail.upstreamStatus}`,
            detail?.cfRay && `CF-Ray：${detail.cfRay}`
        ].filter(Boolean).join('\n')
        inspectionDialog.value = true
    } finally {
        inspecting.value = false
        await refresh(false, true)
    }
}
async function run(draw = false) {
    const busy = draw ? drawing : running
    busy.value = true
    try {
        const result = await api(draw ? '/lottery/run' : '/run', {})
        const message = result.message || result.record?.message
        if (['failed', 'unconfirmed'].includes(result.record?.status)) ElMessage.warning(message)
        else ElMessage.success(message)
    } catch (reason) {
        ElMessage.error((reason as Error).message)
    } finally {
        busy.value = false
        await refresh(false, true)
    }
}
function requestCookie() {
    helperReady.value = document.body.getAttribute('get-cookie') === 'true'
    if (!helperReady.value) {
        helperDialog.value = true
        return
    }
    awaitingCookieUntil = Date.now() + 120000
}
function receiveCookie(event: MessageEvent) {
    if (event.source !== window || event.origin !== window.location.origin) return
    if (event.data?.info === 'get-cookieModReady') {
        helperReady.value = true
        return
    }
    if (event.data?.info !== 'cookieRaw' || Date.now() > awaitingCookieUntil) return
    awaitingCookieUntil = 0
    const data = event.data.data
    const required = isFnat.value ? ['PHPSESSID'] : ['X9wU_2132_auth', 'X9wU_2132_saltkey']
    if (!data || typeof data !== 'object' || !required.every((name) => typeof data[name] === 'string' && data[name])) {
        ElMessage.error(`未获取到${siteName.value}的完整登录信息，请确认该站点已登录`)
        return
    }
    const pairs = Object.entries(data).filter(([key]) => !isFnat.value || key === 'PHPSESSID')
    if (!pairs.every(([key, value]) => /^[A-Za-z0-9_]+$/.test(key) && typeof value === 'string' && !/[;\r\n]/.test(value))) {
        ElMessage.error('插件返回的 Cookie 格式不正确')
        return
    }
    form.cookie = pairs.map(([key, value]) => key + '=' + value).join('; ')
    ElMessage.success(`已获取${siteName.value} Cookie，请点击保存配置`)
}
onMounted(async () => {
    window.addEventListener('message', receiveCookie)
    await refresh(true)
    timer = setInterval(() => refresh(false, true), 5000)
})
onUnmounted(() => {
    clearInterval(timer)
    window.removeEventListener('message', receiveCookie)
})
</script>

<style scoped lang="scss">
.checkin-page {
    min-width: 0;
    color: var(--ui-text);
}
.page-header {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: flex-end;
    gap: 10px 16px;
    margin-bottom: 18px;
    p {
        margin: 5px 0 0;
        color: var(--ui-muted);
        font-size: 14px;
    }
}
.page-alert {
    margin-bottom: 18px;
}
.overview {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin-bottom: 16px;
    background: var(--ui-surface);
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius);
}
.summary-item {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
    padding: 14px 16px;
    overflow-wrap: anywhere;
    & + & {
        border-left: 1px solid var(--ui-border);
    }
    strong {
        font-size: 18px;
        font-weight: 650;
        font-variant-numeric: tabular-nums;
    }
    small {
        color: var(--ui-muted);
        line-height: 1.5;
    }
}
.summary-label,
.subtle {
    color: var(--ui-muted);
    font-size: 13px;
}
.status-dot {
    width: 8px;
    height: 8px;
    display: inline-block;
    margin-right: 9px;
    border-radius: 50%;
    background: var(--el-color-info);
    &.active {
        background: var(--el-color-success);
    }
}
.page-columns {
    display: grid;
    grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
    gap: 16px;
    align-items: start;
}
.config-card,
.record-card {
    min-width: 0;
    --el-card-border-color: var(--ui-border);
    --el-card-border-radius: var(--ui-radius);
    --el-card-padding: 16px;
    --el-card-bg-color: var(--ui-surface);
}
h2 {
    margin: 0;
    font-size: 16px;
    font-weight: 650;
}
.card-heading {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 8px 12px;
    a {
        color: var(--ui-accent);
        font-size: 13px;
        text-decoration: none;
        &:hover,
        &:focus-visible {
            text-decoration: underline;
        }
    }
}
.form-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.3fr);
    gap: 14px;
}
.cookie-label {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    width: 100%;
    gap: 4px 8px;
}
:deep(.el-form-item__label) {
    width: 100%;
}
.cookie-button {
    border: 0;
    background: transparent;
    color: var(--ui-accent);
    cursor: pointer;
    font-size: 13px;
    padding: 4px 0;
    &:hover,
    &:focus-visible {
        text-decoration: underline;
    }
}
.config-card :deep(.el-button.is-link) {
    height: auto;
    white-space: normal;
    text-align: left;
}
.field-help {
    margin: 6px 0 0;
    width: 100%;
    color: var(--ui-muted);
    font-size: 13px;
    line-height: 1.6;
    overflow-wrap: anywhere;
}
.advanced-settings {
    margin: 0 0 18px;
    border-top: 0;
}
.form-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    :deep(.el-button) {
        margin-left: 0;
    }
}
.guard-note {
    margin: 12px 0 16px;
}
.login-warning {
    margin-bottom: 12px;
}
.risk-confirm {
    align-items: flex-start;
    height: auto;
    max-width: 100%;
    margin: 0 0 18px;
    white-space: normal;
    :deep(.el-checkbox__input) {
        flex: none;
        margin-top: 2px;
    }
    :deep(.el-checkbox__label) {
        line-height: 1.6;
        white-space: normal;
    }
}
.run-record {
    padding: 14px 0;
    border-bottom: 1px solid var(--ui-border);
    &:first-child {
        padding-top: 0;
    }
    &:last-child {
        border-bottom: 0;
        padding-bottom: 0;
    }
}
.record-heading {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 6px 10px;
    strong {
        font-weight: 650;
        font-variant-numeric: tabular-nums;
    }
}
.record-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
}
.record-message {
    margin: 8px 0;
    font-size: 14px;
    line-height: 1.6;
    overflow-wrap: anywhere;
}
.record-meta {
    margin: 8px 0 0;
    color: var(--ui-muted);
    font-size: 12px;
    line-height: 1.5;
    overflow-wrap: anywhere;
}
.counters {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    font-size: 13px;
    color: var(--ui-muted);
    b {
        color: var(--ui-text);
        font-weight: 650;
    }
}
.detail-label {
    flex-shrink: 0;
}
.request-summary {
    margin: 0 0 12px;
    color: var(--ui-muted);
    overflow-wrap: anywhere;
}
.request-details {
    section + section {
        margin-top: 16px;
    }
    h3 {
        margin: 0 0 6px;
        font-size: 14px;
        font-weight: 600;
    }
    pre {
        margin: 0;
        padding: 10px 12px;
        border: 1px solid var(--ui-border);
        border-radius: var(--ui-radius);
        background: var(--ui-bg);
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        font-size: 12px;
        line-height: 1.6;
    }
}
.diagnostic-copy-input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
}
footer {
    margin-top: 16px;
    font-size: 12px;
    color: var(--ui-muted);
    display: flex;
    justify-content: space-between;
    gap: 10px;
    flex-wrap: wrap;
}
.helper-steps {
    margin: 0;
    padding-left: 20px;
    li {
        margin-bottom: 12px;
        line-height: 1.7;
    }
    code {
        display: block;
        padding: 5px 10px;
        margin-top: 6px;
        border: 1px solid var(--ui-border);
        border-radius: 4px;
        background: var(--ui-bg);
        color: var(--ui-text);
        overflow-wrap: anywhere;
    }
}
@media (max-width: 1000px) {
    .page-columns {
        grid-template-columns: minmax(0, 1fr);
    }
}
@media (max-width: 600px) {
    .overview,
    .form-row {
        grid-template-columns: minmax(0, 1fr);
    }
    .form-row {
        gap: 0;
    }
    .summary-item {
        padding: 10px 12px;
        & + & {
            border-top: 1px solid var(--ui-border);
            border-left: 0;
        }
    }
    .config-card,
    .record-card {
        --el-card-padding: 12px;
    }
}
</style>
