<template>
    <main class="sites-page">
        <header class="page-header">
            <div>
                <el-button link @click="router.push('/')">← 返回首页</el-button>
                <h1>签到站点</h1>
            </div>
            <el-button :icon="Refresh" :loading="loading" @click="loadSites">刷新状态</el-button>
        </header>
        <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
        <ul v-loading="loading" class="site-list">
            <li v-for="site in sites" :key="site.id">
                <RouterLink class="site-row" :to="`/checkin/${site.id}`">
                    <span class="site-name"><strong>{{ site.name }}</strong><small>{{ site.hostname }}</small></span>
                    <el-tag :type="site.enabled ? 'success' : 'info'" effect="plain">{{ site.enabled ? '已开启' : '未开启' }}</el-tag>
                    <span class="site-plan"><small>下次执行（北京时间）</small><strong>{{ site.running ? '正在执行' : formatNext(site.nextRunAt) }}</strong></span>
                    <el-icon class="site-arrow"><ArrowRight /></el-icon>
                </RouterLink>
            </li>
            <li v-if="!loading && !error && !sites.length"><el-empty description="暂无签到站点" :image-size="72" /></li>
        </ul>
    </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { ArrowRight, Refresh } from '@element-plus/icons-vue'
import { adminFetch } from '@/utils/admin-api'

type Site = { id: string; name: string; site: string; enabled: boolean; running: boolean; nextRunAt: string | null }
const router = useRouter()
const sites = ref<(Site & { hostname: string })[]>([])
const loading = ref(false)
const error = ref('')
const formatter = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Shanghai', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const formatNext = (value: string | null) => (value ? formatter.format(new Date(value)) : '未安排')
async function loadSites() {
    loading.value = true
    error.value = ''
    try {
        const response = await adminFetch('/api/checkin/sites')
        if (!response.ok) throw new Error('站点列表请求失败')
        const data: Site[] = await response.json()
        sites.value = data.map((site) => ({ ...site, hostname: new URL(site.site).hostname }))
    } catch {
        error.value = '无法读取签到站点，请确认服务端已更新并正常运行。'
    } finally {
        loading.value = false
    }
}
onMounted(() => {
    void loadSites()
})
</script>

<style scoped>
.sites-page { max-width: 1180px; margin: 0 auto; padding: 28px 24px; color: #303b49; }
.page-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; margin-bottom: 24px; }
h1 { margin: 5px 0 0; font-size: 27px; font-weight: 600; }
.site-list { list-style: none; padding: 0; margin: 16px 0; min-height: 82px; }
.site-row { display: grid; grid-template-columns: minmax(0, 1fr) max-content minmax(135px, 0.65fr) 16px; align-items: center; gap: 20px; padding: 16px 20px; color: inherit; text-decoration: none; border: 1px solid #e6ecf4; border-radius: 8px; background: #fff; }
.site-list li + li { margin-top: 10px; }
.site-row:hover, .site-row:focus-visible { background: #f5f8fc; border-color: #afc9e7; }
.site-name, .site-plan { display: flex; flex-direction: column; gap: 3px; min-width: 0; overflow-wrap: anywhere; }
.site-row strong { font-weight: 600; }
.site-row small, .site-arrow { color: #657489; }
@media (max-width: 500px) {
    .sites-page { padding: 20px 14px; }
    .site-row { grid-template-columns: minmax(0, 1fr) max-content 16px; gap: 8px 12px; padding: 12px; }
    .site-plan { grid-column: 1 / 3; grid-row: 2; }
    .site-arrow { grid-column: 3; grid-row: 1 / 3; }
}
</style>
