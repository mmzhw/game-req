<template>
    <div style="padding: 10px">
        <div style="display: flex; flex-wrap: wrap; gap: 10px">
            <el-button style="margin: 0" type="primary" @click="jump({ name: 'manage', params: { id: 'zcylt' } })">手游后台发送</el-button>
            <el-button style="margin: 0" type="primary" @click="jump({ name: 'dxlzz' })">大侠立志传</el-button>
            <el-button style="margin: 0" type="primary" @click="jump({ name: 'xyzjh' })">下一站江湖2</el-button>
        </div>

        <el-divider border-style="dashed" />
        <control-server @uploadSuccess="addLogs" @uploadError="addLogs" label-width="55" />
        <table-pagination :dataList="logList" />
    </div>
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

const jump = (item: any) => {
    router.push(item)
}
</script>

<style scoped src="../assets/game-req.scss"></style>
