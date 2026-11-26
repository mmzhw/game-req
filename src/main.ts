import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import axios from 'axios'
import { expireSession } from '@/utils/admin-api'

const adminPath = (url?: string) => /^\/(?:api(?:\/|$)|upload(?:Server)?$|restart$)/.test(url || '')
axios.interceptors.request.use((config) => {
    if (adminPath(config.url) && config.method?.toLowerCase() !== 'get') config.headers.set('X-Game-Req', '1')
    return config
})
axios.interceptors.response.use(undefined, (error) => {
    if (adminPath(error.config?.url) && error.response?.status === 401) expireSession()
    return Promise.reject(error)
})

const app = createApp(App)
//导入中文
import zhCn from 'element-plus/es/locale/lang/zh-cn'

app.use(ElementPlus, {
    locale: zhCn,
})

app.use(createPinia())
app.use(router)

app.mount('#app')
