<template>
    <main class="login-page">
        <section class="login-panel">
            <header>
                <el-icon :size="22"><Setting /></el-icon>
                <span>游戏工具箱</span>
            </header>
            <h1>{{ setupRequired === true ? '创建管理员' : '登录后台' }}</h1>
            <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
            <el-form v-if="setupRequired !== null" label-position="top" @submit.prevent="submit">
                <el-form-item label="用户名">
                    <el-input v-model="username" autocomplete="username" maxlength="32" required />
                </el-form-item>
                <el-form-item label="密码">
                    <el-input v-model="password" type="password" :autocomplete="setupRequired ? 'new-password' : 'current-password'" required show-password />
                </el-form-item>
                <el-form-item v-if="setupRequired" label="确认密码">
                    <el-input v-model="confirmation" type="password" autocomplete="new-password" required show-password />
                </el-form-item>
                <el-button type="primary" native-type="submit" :loading="busy">{{ setupRequired ? '注册并登录' : '登录' }}</el-button>
            </el-form>
            <el-button v-else :loading="busy" @click="load">重新连接</el-button>
        </section>
    </main>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Setting } from '@element-plus/icons-vue'
import { adminName, adminRequest, authStatus } from '@/utils/admin-api'

const route = useRoute()
const router = useRouter()
const setupRequired = ref<boolean | null>(null)
const username = ref('')
const password = ref('')
const confirmation = ref('')
const error = ref('')
const busy = ref(false)

function enter() {
    const destination = route.query.next
    return router.replace(typeof destination === 'string' && /^\/(?![\\/])/.test(destination) && router.resolve(destination).name !== 'login' ? destination : '/')
}

async function load() {
    busy.value = true
    error.value = ''
    try {
        const status = await authStatus()
        setupRequired.value = status.setupRequired
        if (status.username) await enter()
    } catch (reason) {
        error.value = (reason as Error).message
    } finally {
        busy.value = false
    }
}

async function submit() {
    if (busy.value) return
    if (setupRequired.value && password.value !== confirmation.value) {
        error.value = '两次输入的密码不一致'
        return
    }
    busy.value = true
    error.value = ''
    try {
        const result = await adminRequest<{ username: string }>(setupRequired.value ? '/api/auth/setup' : '/api/auth/login', {
            username: username.value, password: password.value
        })
        adminName.value = result.username
        await enter()
    } catch (reason) {
        error.value = (reason as Error).message
        if (setupRequired.value) {
            const status = await authStatus().catch(() => null)
            if (status) setupRequired.value = status.setupRequired
        }
    } finally {
        password.value = ''
        confirmation.value = ''
        busy.value = false
    }
}

onMounted(load)
</script>

<style scoped>
.login-page { min-height: 100vh; display: grid; place-items: center; padding: 20px; background: #f2f5f4; }
.login-panel { width: min(100%, 390px); padding: 28px; background: white; border: 1px solid #dce4e1; border-radius: 8px; }
header { display: flex; gap: 10px; align-items: center; color: #25695b; font-weight: 600; }
h1 { font-size: 23px; font-weight: 650; margin: 14px 0 20px; }
.el-alert { margin-bottom: 14px; }
.el-button { width: 100%; margin-top: 4px; }
</style>
