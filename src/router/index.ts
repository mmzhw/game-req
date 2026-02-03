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
