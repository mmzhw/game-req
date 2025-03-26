import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'

const app = createApp(App)
//导入中文
import zhCn from 'element-plus/es/locale/lang/zh-cn'

app.use(ElementPlus, {
    locale: zhCn,
})

app.use(createPinia())
app.use(router)

app.mount('#app')
