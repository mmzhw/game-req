import { createRouter, createWebHistory, createWebHashHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
    history: createWebHashHistory(),
    routes: [
        // {
        //   path: '/',
        //   name: 'home',
        //   component: HomeView
        // },
        // {
        //   path: '/about',
        //   name: 'about',
        //   // route level code-splitting
        //   // this generates a separate chunk (About.[hash].js) for this route
        //   // which is lazy-loaded when the route is visited.
        //   component: () => import('../views/AboutView.vue')
        // },
        {
            path: '/',
            redirect: () => {
                // 方法接收目标路由作为参数
                // return 重定向的字符串路径/路径对象
                return { name: 'manage', params: { id: '1' } }
            }
        },
        {
            path: '/manage/:id',
            name: 'manage',
            component: () => import('../views/GameReq.vue')
        }
        // {
        //     path: '/gjqt',
        //     name: 'gjqt',
        //     component: () => import('../views/GameReq-gjqt.vue')
        // }
    ]
})

export default router
