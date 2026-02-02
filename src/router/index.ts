import { createRouter, createWebHashHistory } from 'vue-router'

// @ts-ignore
// @ts-ignore
// @ts-ignore
// @ts-ignore
const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        {
            path: '/',
            name: '/',
            redirect: () => {
                // 方法接收目标路由作为参数
                // return 重定向的字符串路径/路径对象
                return { name: 'minewy' }
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
            component: () => import('@/views/GameMain.vue')
        },
        {
            path: '/version',
            name: 'version',
            component: () => import('@/views/VersionControl.vue')
        },
        {
            path: '/dj',
            name: 'dj',
            component: () => import('@/views/SaveFileEdit.vue')
        },
        {
            path: '/xyzjh',
            name: 'xyzjh',
            component: () => import('@/views/xyzjhSaveFileEdit.vue')
        }
    ]
})

export default router
