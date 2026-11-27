<template>
    <section class="update-page">
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
.update-page {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 16px;
    min-width: 0;
    color: var(--ui-text);
}
.update-page :deep(.el-table) {
    max-width: 100%;
    border-radius: var(--ui-radius);
}
.update-page :deep(.el-pagination) {
    flex-wrap: wrap;
    row-gap: 8px;
}
</style>
