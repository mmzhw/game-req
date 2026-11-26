<template>
    <RouterView v-if="route.name === 'login'" />
    <div v-else-if="adminName" class="admin-layout">
        <header class="admin-header">
            <div class="brand"><el-icon :size="20"><Setting /></el-icon>游戏工具箱</div>
            <div class="identity"><span>{{ adminName }}</span><el-button link :icon="SwitchButton" :loading="leaving" @click="logout">退出</el-button></div>
        </header>
        <nav class="admin-nav" aria-label="后台菜单">
            <RouterLink v-for="entry in menuBeforeGames" :key="entry.label" :to="entry.to" :class="{ current: entry.active() }">
                <el-icon><component :is="entry.icon" /></el-icon>{{ entry.label }}
            </RouterLink>
            <div class="menu-group">
                <div class="menu-title"><el-icon><Goods /></el-icon>游戏管理</div>
                <RouterLink to="/games" :class="{ current: route.name === 'games' }">
                    <el-icon><DataBoard /></el-icon>控制台
                </RouterLink>
                <RouterLink v-for="game in games" :key="game.key" :to="`/manage/${game.key}`" :class="{ current: route.name === 'manage' && route.params.id === game.key }">
                    <span class="game-mark"></span>{{ game.name }}
                </RouterLink>
            </div>
            <RouterLink v-for="entry in menuAfterGames" :key="entry.label" :to="entry.to" :class="{ current: entry.active() }">
                <el-icon><component :is="entry.icon" /></el-icon>{{ entry.label }}
            </RouterLink>
        </nav>
        <main class="workspace"><RouterView /></main>
    </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { DataBoard, Files, Goods, Setting, SwitchButton, Timer } from '@element-plus/icons-vue'
import { adminName, adminRequest, gamesChanged } from '@/utils/admin-api'
import type { GameRecord } from '@/utils/game-templates'

const route = useRoute()
const router = useRouter()
const leaving = ref(false)
const games = ref<GameRecord[]>([])
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
.admin-layout { min-height: 100vh; display: grid; grid-template-columns: 190px minmax(0, 1fr); grid-template-rows: 54px 1fr; }
.admin-header { grid-column: 1 / -1; display: flex; justify-content: space-between; gap: 12px; padding: 0 20px; align-items: center; background: #fff; border-bottom: 1px solid #e0e5e3; position: sticky; top: 0; z-index: 2; }
.brand, .identity { display: flex; align-items: center; gap: 10px; min-width: 0; }
.brand { font-weight: 700; color: #215a4f; white-space: nowrap; }
.identity span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.admin-nav { background: #f6f8f7; padding: 12px 8px; border-right: 1px solid #e0e5e3; position: sticky; top: 54px; height: calc(100vh - 54px); overflow-y: auto; align-self: start; }
.admin-nav a { display: flex; align-items: center; gap: 9px; padding: 9px 12px; min-height: 40px; margin-bottom: 3px; color: #34443f; text-decoration: none; white-space: nowrap; font-size: 14px; }
.admin-nav a:hover, .admin-nav a.current { background: #e9f1ee; color: #205f51; }
.admin-nav a.current { font-weight: 650; }
.menu-group { margin: 4px 0 8px; }
.menu-title { display: flex; align-items: center; gap: 9px; min-height: 36px; padding: 7px 12px; color: #243c35; font-weight: 650; }
.menu-group a { padding-left: 28px; }
.game-mark { width: 5px; height: 5px; border-radius: 50%; background: #78948b; flex: 0 0 auto; }
.workspace { min-width: 0; }
@media (max-width: 700px) {
    .admin-layout { grid-template-columns: minmax(0, 1fr); grid-template-rows: 50px auto 1fr; }
    .admin-header { padding: 0 12px; }
    .admin-nav { display: flex; overflow-x: auto; padding: 4px; border: 0; border-bottom: 1px solid #e0e5e3; height: auto; top: 50px; z-index: 1; }
    .admin-nav a { margin-bottom: 0; padding: 7px 10px; }
}
</style>
