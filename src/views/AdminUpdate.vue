<template>
    <section class="update-page">
        <h1>服务更新</h1>
        <ControlServer @upload-success="addLog" @upload-error="addLog" />
        <TablePagination v-if="logs.length" :dataList="logs" />
    </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ControlServer from '@/components/Control-Server.vue'
import TablePagination from '@/components/Table-Pagination.vue'

const logs = ref<{ no: number; message: string }[]>([])
function addLog(message: string) {
    logs.value.unshift({ no: logs.value.length + 1, message })
}
</script>

<style scoped>
.update-page { padding: 24px; }
h1 { font-size: 23px; font-weight: 650; margin-bottom: 16px; }
</style>
