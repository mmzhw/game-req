import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        {
            path: '/',
            name: '/',
            redirect: () => {
                // 方法接收目标路由作为参数
                // return 重定向的字符串路径/路径对象
                return { name: 'dj' }
            }
        },
        {
            path: '/minewy',
            name: 'minewy',
            redirect: () => {
                return { name: 'manage', params: { id: 'zcylt' } }
            }
        },
        {
            path: '/manage/:id',
            name: 'manage',
            component: () => import('../views/GameMain.vue')
        },
        {
            path: '/version',
            name: 'version',
            component: () => import('../views/VersionControl.vue')
        },
        {
            path: '/dj',
            name: 'dj',
            // @ts-ignore
            component: () => import('../views/SaveFileEdit.vue')
        }
    ]
})

export default router
