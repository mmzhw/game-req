<template>
    <section class="overview">
        <h1>工作台</h1>
        <dl>
            <div v-for="entry in entries" :key="entry.to">
                <dt><RouterLink :to="entry.to">{{ entry.label }}</RouterLink></dt>
                <dd>{{ entry.value ?? '—' }}{{ entry.value !== null ? ` ${entry.unit}` : '' }}</dd>
            </div>
        </dl>
    </section>
</template>

<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { adminRequest } from '@/utils/admin-api'

const entries = ref([
    { label: '已配置的游戏', to: '/games', value: null as number | null, unit: '个' },
    { label: '已启用的签到站点', to: '/checkin', value: null as number | null, unit: '个' }
])

onMounted(async () => {
    const [catalogs, sites] = await Promise.allSettled([
        adminRequest<{ key: string }[]>('/api/games'),
        adminRequest<{ enabled: boolean }[]>('/api/checkin/sites')
    ])
    if (catalogs.status === 'fulfilled') entries.value[0].value = catalogs.value.length
    if (sites.status === 'fulfilled') entries.value[1].value = sites.value.filter((site) => site.enabled).length
})
</script>

<style scoped>
.overview { padding: 24px; }
h1 { font-size: 23px; font-weight: 650; margin-bottom: 16px; }
dl { margin: 0; max-width: 560px; }
dl div { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 14px 0; border-bottom: 1px solid #e0e5e3; }
dt a { color: #205f51; }
dd { margin: 0; white-space: nowrap; font-variant-numeric: tabular-nums; }
</style>
