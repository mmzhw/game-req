import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
    // 根据当前工作目录中的 `mode` 加载 .env 文件
    // 设置第三个参数为 '' 来加载所有环境变量，而不管是否有 `VITE_` 前缀。
    return {
        plugins: [vue(), vueJsx()],
        resolve: {
            alias: {
                '@': fileURLToPath(new URL('./src', import.meta.url))
            }
        },
        css: {
            preprocessorOptions: {
                scss: {}
            }
        },
        base: './',
        build: {
            outDir: './server/dist'
        },
        // vite 配置
        define: {
            __Admin_VERSION__: JSON.stringify(process.env.npm_package_version)
        },
        server: {
            host: '0.0.0.0', // 允许局域网访问
            port: 5173, // 可选：指定端口号
            strictPort: false // 如果端口被占用，自动尝试下一个可用端口
        }
    }
})
