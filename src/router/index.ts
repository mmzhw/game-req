import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        {
            path: '/',
            name: 'main',
            redirect: () => {
                // 方法接收目标路由作为参数
                // return 重定向的字符串路径/路径对象
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

    ]
})

export default router
