import { createRouter, createWebHashHistory } from 'vue-router'
const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        {
            path: '/',
            name: 'index',
            component: () => import('@/views/HOME.vue')
        },
        {
            path: '/manage/:id',
            name: 'manage',
            component: () => import('@/views/GameMain.vue')
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
            meta: { title: '老王论坛签到' }
        },
        {
            path: '/checkin/fnat',
            name: 'checkin-fnat',
            component: () => import('@/views/CheckinConfig.vue'),
            props: { provider: 'fnat' },
            meta: { title: 'FNAT 签到' }
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
        }
    ]
})

export default router
