<template>
    <RouterView v-if="route.name === 'login'" />
    <div v-else-if="adminName" class="admin-layout">
        <header class="admin-header">
            <div class="brand"><el-icon :size="20"><Setting /></el-icon>游戏工具箱</div>
            <div class="identity"><span>{{ adminName }}</span><el-button link :icon="SwitchButton" :loading="leaving" @click="logout">退出</el-button></div>
        </header>
        <nav class="admin-nav" aria-label="后台菜单">
            <el-scrollbar class="nav-scroll" view-class="nav-links">
                <RouterLink v-for="entry in menuBeforeGames" :key="entry.label" :to="entry.to" :class="{ current: entry.active() }">
                    <el-icon><component :is="entry.icon" /></el-icon>{{ entry.label }}
                </RouterLink>
                <div class="menu-group">
                    <div class="menu-title"><el-icon><Goods /></el-icon>游戏管理</div>
                    <el-scrollbar class="game-links-scroll" view-class="game-links">
                        <RouterLink to="/games" :class="{ current: route.name === 'games' }">
                            <el-icon><DataBoard /></el-icon>控制台
                        </RouterLink>
                        <RouterLink v-for="game in games" :key="game.key" :to="`/manage/${game.key}`" :class="{ current: route.name === 'manage' && route.params.id === game.key }">
                            <span class="game-mark"></span>{{ game.name }}
                        </RouterLink>
                    </el-scrollbar>
                </div>
                <RouterLink v-for="entry in menuAfterGames" :key="entry.label" :to="entry.to" :class="{ current: entry.active() }">
                    <el-icon><component :is="entry.icon" /></el-icon>{{ entry.label }}
                </RouterLink>
            </el-scrollbar>
        </nav>
        <main class="workspace">
            <nav class="workspace-breadcrumb" aria-label="面包屑">
                <ol>
                    <li v-for="(item, index) in breadcrumbs" :key="index">
                        <el-icon v-if="index > 0" aria-hidden="true"><ArrowRight /></el-icon>
                        <RouterLink v-if="item.to" :to="{ name: item.to }">{{ item.label }}</RouterLink>
                        <span v-else aria-current="page">{{ item.label }}</span>
                    </li>
                </ol>
            </nav>
            <RouterView />
        </main>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowRight, DataBoard, Files, Goods, Setting, SwitchButton, Timer } from '@element-plus/icons-vue'
import { adminName, adminRequest, gamesChanged } from '@/utils/admin-api'
import type { GameRecord } from '@/utils/game-templates'

const route = useRoute()
const router = useRouter()
const leaving = ref(false)
const games = ref<GameRecord[]>([])
const breadcrumbs = computed(() => {
    const items: { label: string; to?: string }[] = [{ label: '工作台' }]
    if (route.name === 'index') return items

    items[0].to = 'index'
    const parent = route.meta.breadcrumbParent
    if (parent) {
        const { meta } = router.resolve({ name: parent })
        if (meta.title) items.push({ label: meta.title, to: parent })
    }
    const gameName = route.name === 'manage'
        ? games.value.find((game) => game.key === route.params.id)?.name
        : undefined
    items.push({ label: gameName || route.meta.title || '游戏工具箱' })
    return items
})
const menuBeforeGames = [
    { to: '/', label: '工作台', icon: DataBoard, active: () => route.path === '/' },
]
const menuAfterGames = [
    { to: '/checkin', label: '每日签到', icon: Timer, active: () => route.path.startsWith('/checkin') },
    { to: '/dxlzz', label: '大侠立志传存档', icon: Files, active: () => route.name === 'dxlzz' },
    { to: '/xyzjh', label: '下一站江湖2存档', icon: Files, active: () => route.name === 'xyzjh' },
    { to: '/system/update', label: '服务更新', icon: Setting, active: () => route.name === 'system-update' }
]
const loadGames = async () => {
    games.value = await adminRequest<GameRecord[]>('/api/games/enabled')
}
onMounted(() => {
    void loadGames()
    window.addEventListener(gamesChanged, loadGames)
})
onBeforeUnmount(() => window.removeEventListener(gamesChanged, loadGames))
async function logout() {
    leaving.value = true
    try {
        await adminRequest('/api/auth/logout', {})
        adminName.value = null
        await router.replace({ name: 'login' })
    } catch (reason) {
        ElMessage.error((reason as Error).message)
    } finally {
        leaving.value = false
    }
}
</script>

<style scoped>
.admin-layout {
    display: grid;
    grid-template-columns: 204px minmax(0, 1fr);
    grid-template-rows: var(--ui-header-height) 1fr;
    min-height: 100vh;
}
.admin-header {
    position: sticky;
    top: 0;
    z-index: 5;
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding-inline: var(--ui-page-pad);
    background: var(--ui-surface);
    border-bottom: 1px solid var(--ui-border);
}
.brand, .identity { display: flex; align-items: center; gap: 10px; min-width: 0; }
.brand { color: var(--ui-text); font-size: 17px; font-weight: 700; white-space: nowrap; }
.brand .el-icon {
    flex: 0 0 auto;
    width: 34px;
    height: 34px;
    border-radius: var(--ui-radius);
    background: var(--ui-accent);
    color: white;
}
.identity { color: var(--ui-muted); }
.identity span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.identity .el-button { flex: 0 0 auto; min-height: 40px; padding: 0 8px; }
.admin-nav {
    position: sticky;
    top: var(--ui-header-height);
    align-self: start;
    min-width: 0;
    height: calc(100vh - var(--ui-header-height));
    height: calc(100dvh - var(--ui-header-height));
    background: var(--ui-surface);
    border-right: 1px solid var(--ui-border);
}
.nav-scroll { height: 100%; }
.nav-scroll :deep(.nav-links) {
    display: grid;
    align-content: start;
    gap: 4px;
    padding: 18px 12px;
}
.admin-nav a {
    display: flex;
    align-items: center;
    gap: 9px;
    min-width: 0;
    min-height: 42px;
    padding: 8px 11px;
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--ui-muted);
    line-height: 1.4;
    overflow-wrap: anywhere;
    text-decoration: none;
}
.admin-nav .el-icon { flex: 0 0 auto; font-size: 16px; }
.admin-nav a:hover { background: var(--ui-subtle); color: var(--ui-text); }
.admin-nav a.current {
    border-color: #ccede3;
    background: var(--ui-accent-soft);
    color: var(--ui-accent-hover);
    font-weight: 650;
}
.menu-group { margin: 4px 0; }
.game-links-scroll, .game-links-scroll > :deep(.el-scrollbar__wrap) { height: auto; }
.game-links-scroll { min-width: 0; }
.game-links-scroll :deep(.game-links) { display: grid; grid-template-columns: minmax(0, 1fr); gap: 4px; }
.menu-title { display: flex; align-items: center; gap: 9px; padding: 7px 12px; color: var(--ui-text); font-size: 13px; font-weight: 650; }
.menu-group a { padding-left: 22px; }
.game-mark { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: 0 0 auto; }
.workspace {
    min-width: 0;
    padding: 16px 18px 24px;
}
.workspace-breadcrumb {
    margin-bottom: 10px;
    color: var(--ui-muted);
    font-size: 13px;
}
.workspace-breadcrumb ol {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0 8px;
    margin: 0;
    padding: 0;
    list-style: none;
}
.workspace-breadcrumb li {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    min-height: 28px;
    overflow-wrap: anywhere;
}
.workspace-breadcrumb .el-icon { flex: none; }
.workspace-breadcrumb a { color: inherit; text-decoration: none; }
.workspace-breadcrumb a:hover, .workspace-breadcrumb a:focus-visible {
    color: var(--ui-accent-hover);
    text-decoration: underline;
}
.workspace-breadcrumb [aria-current] { color: var(--ui-text); font-weight: 650; }
@media (max-width: 780px) {
    .admin-layout { grid-template-columns: minmax(0, 1fr); grid-template-rows: var(--ui-header-height) auto 1fr; }
    .admin-header { gap: 10px; }
    .brand { gap: 8px; font-size: 16px; }
    .brand .el-icon { width: 32px; height: 32px; }
    .identity { gap: 4px; font-size: 13px; }
    .identity .el-button { min-height: 44px; }
    .admin-nav {
        position: static;
        height: auto;
        border: 0;
        border-bottom: 1px solid var(--ui-border);
    }
    .nav-scroll, .nav-scroll > :deep(.el-scrollbar__wrap) { height: auto; }
    .nav-scroll :deep(.nav-links) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 4px 6px;
        padding: 8px var(--ui-page-pad) 10px;
    }
    .admin-nav a { min-height: 44px; gap: 6px; padding: 6px 8px; font-size: 13px; }
    .nav-scroll :deep(.nav-links > a:first-child), .menu-group { grid-column: 1 / -1; }
    .menu-group {
        min-width: 0;
        margin: 2px 0;
        padding-block: 3px;
        border-block: 1px solid var(--ui-border);
    }
    .menu-title { padding: 4px 8px 0; }
    .game-links-scroll :deep(.game-links) {
        display: flex;
        gap: 6px;
        padding: 4px 3px 8px;
    }
    .game-links-scroll :deep(.game-links a) {
        flex: 0 0 auto;
        max-width: 75%;
        background: var(--ui-subtle);
    }
    .game-links-scroll :deep(.game-links a.current) { background: var(--ui-accent-soft); }
    .workspace { padding: 12px 12px 20px; }
    .workspace-breadcrumb { margin-bottom: 8px; }
    .workspace-breadcrumb li { min-height: 36px; }
    .workspace-breadcrumb a { padding-block: 8px; }
}
@media (min-width: 520px) and (max-width: 780px) {
    .nav-scroll :deep(.nav-links) { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
</style>
