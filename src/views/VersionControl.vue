<template>
    <control-server
        @uploadSuccess="addLogs"
        @uploadError="addLogs"
        label-width="55"
    />

    <!--        <el-button @click="addLogs('sdfd')"></el-button>-->
    <table-pagination :dataList="logList" />
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import ControlServer from '../components/Control-Server.vue'
import TablePagination from '../components/Table-Pagination.vue'

let logList: any = ref([])

const addLogs = (message: any) => {
    logList.value.unshift({ no: logList.value.length + 1, message: message })
}
</script>

<style scoped src="../assets/game-req.scss"></style>
