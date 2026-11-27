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
.login-page {
    display: grid;
    place-items: center;
    min-height: 100vh;
    min-height: 100svh;
    padding: 24px var(--ui-page-pad);
    background-color: var(--ui-bg);
    background-image: radial-gradient(#d9e2e6 1px, transparent 1px);
    background-size: 20px 20px;
}
.login-panel {
    width: min(100%, 420px);
    padding: 30px 32px 32px;
    border: 1px solid var(--ui-border);
    border-top: 3px solid var(--ui-accent);
    border-radius: var(--ui-radius);
    background: var(--ui-surface);
    box-shadow: 0 12px 36px rgb(29 41 57 / 9%);
}
header { display: flex; align-items: center; gap: 10px; color: var(--ui-text); font-size: 15px; font-weight: 650; }
header .el-icon { width: 38px; height: 38px; border-radius: var(--ui-radius); background: var(--ui-accent); color: white; }
h1 { margin: 20px 0; font-size: 26px; font-weight: 700; line-height: 1.25; }
.el-alert { margin-bottom: 16px; }
.el-button { width: 100%; min-height: 44px; margin-top: 6px; }
@media (max-width: 520px) {
    .login-panel { padding: 22px 20px 24px; }
    h1 { margin-block: 16px; font-size: 23px; }
}
</style>
