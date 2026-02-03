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
            name: 'index',
            redirect: () => {
                // 方法接收目标路由作为参数
                // return 重定向的字符串路径/路径对象
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
            path: '/dxlzz',
            name: 'dxlzz',
            // @ts-ignore
            component: () => import('@/views/SaveFileEditDxlzz.vue'),
            meta: {
                title: '大侠立志传存档编辑器'
            }
        },
        {
            path: '/xyzjh',
            name: 'xyzjh',
            // @ts-ignore
            component: () => import('@/views/SaveFileEditXyzjh.vue'),
            meta: {
                title: '下一站江湖2存档编辑器'
            }
        }
    ]
})

export default router
