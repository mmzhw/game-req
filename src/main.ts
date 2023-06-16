import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

const app = createApp(App)
//导入中文
import zhLocale from 'element-plus/lib/locale/lang/zh-CN'

app.use(ElementPlus, {
    locale: zhLocale
})

app.use(createPinia())
app.use(router)
app.use(ElementPlus)

app.mount('#app')
