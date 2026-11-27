import { createRouter, createWebHashHistory } from 'vue-router'
import { adminName, authStatus, sessionExpired } from '@/utils/admin-api'

declare module 'vue-router' {
    interface RouteMeta {
        title?: string
        breadcrumbParent?: 'games' | 'checkin'
    }
}

const DEFAULT_TITLE = '游戏工具箱'

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        { path: '/login', name: 'login', component: () => import('@/views/AdminLogin.vue'), meta: { title: '后台登录' } },
        { path: '/games', name: 'games', component: () => import('@/views/AdminItems.vue'), meta: { title: '游戏控制台' } },
        { path: '/games/:id/items', name: 'game-items', component: () => import('@/views/AdminGameItems.vue'), meta: { title: '编辑物品', breadcrumbParent: 'games' } },
        { path: '/catalogs', redirect: '/games' },
        { path: '/system/update', name: 'system-update', component: () => import('@/views/AdminUpdate.vue'), meta: { title: '服务更新' } },
        {
            path: '/',
            name: 'index',
            component: () => import('@/views/HOME.vue'),
            meta: { title: DEFAULT_TITLE }
        },
        {
            path: '/manage/:id',
            name: 'manage',
            component: () => import('@/views/GameMain.vue'),
            meta: { title: '手游后台发送', breadcrumbParent: 'games' }
        },
        {
            path: '/checkin',
            name: 'checkin',
            component: () => import('@/views/CheckinSites.vue'),
            meta: { title: '每日签到' }
        },
        {
            path: '/checkin/laowang',
            name: 'checkin-laowang',
            component: () => import('@/views/CheckinConfig.vue'),
            meta: { title: '老王论坛签到', breadcrumbParent: 'checkin' }
        },
        {
            path: '/checkin/fnat',
            name: 'checkin-fnat',
            component: () => import('@/views/CheckinConfig.vue'),
            props: { provider: 'fnat' },
            meta: { title: 'FNAT 签到', breadcrumbParent: 'checkin' }
        },
        {
            path: '/dxlzz',
            name: 'dxlzz',
            component: () => import('@/views/SaveFileEditDxlzz.vue'),
            meta: {
                title: '大侠立志传存档编辑器'
            }
        },
        {
            path: '/xyzjh',
            name: 'xyzjh',
            component: () => import('@/views/SaveFileEditXyzjh.vue'),
            meta: {
                title: '下一站江湖2存档编辑器'
            }
        },
        { path: '/:pathMatch(.*)*', redirect: '/' }
    ]
})

router.beforeEach(async (to) => {
    if (to.name === 'login') return
    const status = await authStatus().catch(() => null)
    adminName.value = status?.username || null
    if (!adminName.value) return { name: 'login', query: { next: to.fullPath } }
})

window.addEventListener(sessionExpired, () => {
    if (router.currentRoute.value.name !== 'login') void router.replace({ name: 'login', query: { next: router.currentRoute.value.fullPath } })
})

router.afterEach((to) => {
    document.title = String(to.meta.title || DEFAULT_TITLE)
})

export default router
