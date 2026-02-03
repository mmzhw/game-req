<template>
    <el-button type="primary" @click="jump('index')">手游后台发送</el-button>
    <el-button type="primary" @click="jump('dxlzz')">大侠立志传存档编辑器</el-button>
    <el-button type="primary" @click="jump('xyzjh')">下一站江湖2存档编辑器</el-button>
    <el-divider border-style="dashed" />
    <control-server @uploadSuccess="addLogs" @uploadError="addLogs" label-width="55" />
    <table-pagination :dataList="logList" />
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import ControlServer from '../components/Control-Server.vue'
import TablePagination from '../components/Table-Pagination.vue'
import { useRouter } from 'vue-router'

const router = useRouter()

let logList: any = ref([])

const addLogs = (message: any) => {
    logList.value.unshift({ no: logList.value.length + 1, message: message })
}

const jump = (name: string) => {
    router.push({ name })
}
</script>

<style scoped src="../assets/game-req.scss"></style>
