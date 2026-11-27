<template>
    <main class="sites-page business-panel">
        <header class="page-header">
            <el-button :icon="Refresh" :loading="loading" @click="loadSites">刷新状态</el-button>
        </header>
        <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
        <ul v-loading="loading" class="site-list">
            <li v-for="site in sites" :key="site.id">
                <RouterLink class="site-card" :to="`/checkin/${site.id}`">
                    <span class="site-card-head">
                        <span class="site-name"><strong>{{ site.name }}</strong><small>{{ site.hostname }}</small></span>
                        <el-tag :type="site.enabled ? 'success' : 'info'" effect="plain">{{ site.enabled ? '已开启' : '未开启' }}</el-tag>
                    </span>
                    <span class="site-card-foot">
                        <span class="site-plan"><small>下次执行（北京时间）</small><strong>{{ site.running ? '正在执行' : formatNext(site.nextRunAt) }}</strong></span>
                        <el-icon class="site-arrow" aria-hidden="true"><ArrowRight /></el-icon>
                    </span>
                </RouterLink>
            </li>
            <li v-if="!loading && !error && !sites.length" class="site-empty"><el-empty description="暂无签到站点" :image-size="72" /></li>
        </ul>
    </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ArrowRight, Refresh } from '@element-plus/icons-vue'
import { adminFetch } from '@/utils/admin-api'

type Site = { id: string; name: string; site: string; enabled: boolean; running: boolean; nextRunAt: string | null }
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
.sites-page {
    min-width: 0;
    color: var(--ui-text);
}
.page-header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
    gap: 10px 16px;
    margin-bottom: 18px;
}
.site-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr));
    gap: 12px;
    list-style: none;
    min-height: 82px;
    padding: 0;
    margin: 0;
}
.site-list > li {
    min-width: 0;
}
.site-empty {
    grid-column: 1 / -1;
}
.sites-page > .el-alert {
    margin-bottom: 12px;
}
.site-card {
    display: flex;
    flex-direction: column;
    gap: 14px;
    height: 100%;
    padding: 16px;
    color: inherit;
    text-decoration: none;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius);
    background: var(--ui-surface);
}
.site-card:hover,
.site-card:focus-visible {
    background: var(--ui-accent-soft);
    border-color: var(--ui-accent);
}
.site-card:focus-visible {
    outline: 2px solid var(--ui-accent);
    outline-offset: 2px;
}
.site-card-head,
.site-card-foot {
    display: flex;
    justify-content: space-between;
    gap: 12px;
}
.site-card-head {
    align-items: flex-start;
}
.site-card-foot {
    align-items: center;
    margin-top: auto;
    padding-top: 12px;
    border-top: 1px solid var(--ui-border);
}
.site-name,
.site-plan {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    overflow-wrap: anywhere;
}
.site-card strong {
    font-weight: 650;
}
.site-name strong {
    font-size: 16px;
}
.site-card small,
.site-arrow {
    color: var(--ui-muted);
}
.site-plan strong {
    font-size: 14px;
    font-variant-numeric: tabular-nums;
}
.site-card-head .el-tag,
.site-arrow {
    flex: none;
}
@media (max-width: 600px) {
    .site-card {
        gap: 12px;
        padding: 12px;
    }
}
</style>
