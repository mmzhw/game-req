<template>
    <section class="overview">
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
dl { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; max-width: 880px; }
dl > div {
    position: relative;
    display: grid;
    gap: 12px;
    min-width: 0;
    align-content: start;
    padding: 18px 20px;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius);
    background: var(--ui-surface);
    box-shadow: var(--ui-shadow);
}
dl > div:focus-within { border-color: var(--ui-accent); }
dt a {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 32px;
    color: var(--ui-accent-hover);
    font-weight: 650;
    text-decoration: none;
}
dt a:hover { text-decoration: underline; text-underline-offset: 4px; }
dt a::after {
    content: '';
    flex: 0 0 8px;
    height: 8px;
    margin-right: 4px;
    border-top: 2px solid currentColor;
    border-right: 2px solid currentColor;
    transform: rotate(45deg);
}
dd { color: var(--ui-text); font-size: 30px; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
@media (max-width: 520px) {
    dl { grid-template-columns: minmax(0, 1fr); gap: 10px; }
    dl > div { grid-template-columns: minmax(0, 1fr) auto; gap: 16px; align-items: center; padding: 10px 14px; }
    dt a { min-height: 44px; }
    dd { font-size: 24px; }
}
</style>
