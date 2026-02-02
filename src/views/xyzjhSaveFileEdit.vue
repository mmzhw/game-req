<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'

let fileContent: any = {}

const itemObj = ref({})
const currentPage = ref(1)
const pageSize = ref(10) // 每页显示10个条目

const handleFileSelect = (event) => {
    const target = event.target
    const files = target.files

    if (files && files.length > 0) {
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const content: any = e.target?.result
                fileContent = JSON.parse(content)
                itemObj.value = fileContent.playerentity['1'].itemStorage.content

                console.log(itemObj.value)
            } catch (error) {
                console.log(error)
            }
        }
        reader.onerror = () => {}
        reader.readAsText(files[0])
    }
}

const handleChange = (key) => {
    console.log(itemObj.value[key])
}

// 获取当前页的数据
const paginatedItems = computed(() => {
    const keys = Object.keys(itemObj.value)
    const startIndex = (currentPage.value - 1) * pageSize.value
    const endIndex = startIndex + pageSize.value
    return keys.slice(startIndex, endIndex)
})

const handlePageChange = (page) => {
    currentPage.value = page
}

const itemOptions = ref([])
onMounted(async () => {
    let response = await axios.get('db1_parsed.json')
    itemOptions.value = response.data || []
})

const saveFile = () => {
    fileContent.playerentity['1'].itemStorage.content = itemObj.value
    console.log(fileContent.playerentity['1'].itemStorage.content)
}
</script>

<template>
    <div class="container">
        <div style="display: flex; align-items: center">
            <input style="padding-bottom: 10px" type="file" accept=".json" @change="handleFileSelect" />
            <el-button type="primary" @click="saveFile">保存</el-button>
        </div>
        <template v-for="key in paginatedItems" :key="key">
            <div class="item-wrap">
                <div>位置：{{ key }}</div>
                <div style="display: flex; align-items: center; gap: 10px; padding-top: 10px" v-for="subkey in Object.keys(itemObj[key])" :key="key + subkey">
                    <div style="width: 30px">{{ subkey }}：</div>
                    <el-select-v2 class="item-edit" v-if="subkey === '1'" v-model="itemObj[key][subkey]" :options="itemOptions" @change="handleChange(key)" />
                    <el-switch class="item-edit" v-else-if="typeof itemObj[key][subkey] === 'boolean'" v-model="itemObj[key][subkey]" @change="handleChange(key)" />
                    <el-input-number class="item-edit" v-else-if="!isNaN(Number(itemObj[key][subkey]))" v-model="itemObj[key][subkey]" @change="handleChange(key)" />
                    <el-input class="item-edit" v-else v-model="itemObj[key][subkey]" @change="handleChange(key)" />
                </div>
            </div>
            <el-divider border-style="dashed" />
        </template>
        <el-pagination v-if="Object.keys(itemObj).length" class="page-wrap" v-model:current-page="currentPage" v-model:page-size="pageSize" @current-change="handlePageChange" layout="prev, pager, next" :total="Object.keys(itemObj).length" />
    </div>
</template>

<style scoped>
.container {
    padding: 20px;
}
.item-wrap {
    //display: flex;
    //align-items: center;
    //gap: 10px;
    //padding-bottom: 10px;
}
.item-edit {
    width: 100%;
}
.page-wrap {
    padding-top: 20px;
    width: 100%;
}
</style>
