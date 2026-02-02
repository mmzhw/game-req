<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { cloneDeep, isEmpty } from 'lodash'

const dictMap: any = {
    // 68: '金钱',
    // 69: '修为',
    // 70: '感悟',
    1: { label: '物品代码', type: 'select' },
    2: { label: '数量', type: 'number' },
    5: { label: '锋锐', type: 'number' },
    6: { label: '坚韧', type: 'number' },
    8: { label: '耐久', type: 'number' },
    9: { label: '品质', type: 'number' },
    10: { label: '阶数', type: 'number' },
    11: { label: '11', type: 'number' },
    12: { label: '属性/效果', type: 'input' },
    14: { label: '装备词条', type: 'input' },
    36: { label: '36', type: 'boolean' }
}

let fileContent: any = ref({})
const originalFilename = ref('')

const itemObj = ref({})
const currentPage = ref(1)
const pageSize = ref(10) // 每页显示10个条目

const handleFileSelect = (event) => {
    const target = event.target
    const files = target.files

    if (files && files.length > 0) {
        // 记录原始文件名
        originalFilename.value = files[0].name

        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const content: any = e.target?.result
                fileContent.value = JSON.parse(content)
                itemObj.value = fileContent.value.playerentity['1'].itemStorage.content

                console.log(fileContent.value.playerentity['1'].itemStorage)
            } catch (error) {
                console.log(error)
            }
        }
        reader.onerror = () => {}
        reader.readAsText(files[0])
    }
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
    fileContent.value.playerentity['1'].itemStorage.content = itemObj.value

    // 将修改后的数据转换为JSON字符串
    const jsonData = JSON.stringify(fileContent.value, null, 2)

    // 创建Blob对象
    const blob = new Blob([jsonData], { type: 'application/json' })

    // 创建下载链接
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url

    // 使用原始文件名，如果没有则使用默认名称
    a.download = originalFilename.value || 'savefile0.json'

    // 触发下载
    document.body.appendChild(a)
    a.click()

    // 清理资源
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
}

const dialogVisible = ref(false)
const addItem = () => {
    Object.keys(dictMap).forEach((key) => {
        form[key] = ''
    })
    dialogVisible.value = true
}
const form = ref({})
const saveItem = () => {
    let item = cloneDeep(form.value)
    Object.keys(item).forEach((key) => {
        if (!item[key]) {
            delete item[key]
        }
    })
    let keys = Object.keys(itemObj.value)
    let lastKey = keys[keys.length - 1]
    itemObj.value[Number(lastKey) + 1] = item
    fileContent.value.playerentity['1'].itemStorage.count++
    fileContent.value.playerentity['1'].itemStorage.content = itemObj.value

    dialogVisible.value = false
}
</script>

<template>
    <div class="container">
        <div style="display: flex; align-items: center; padding-bottom: 10px">
            <input type="file" accept=".json" @change="handleFileSelect" />
        </div>
        <div style="display: flex; align-items: center; padding-bottom: 10px">
            <el-button type="primary" @click="saveFile" size="small">保存</el-button>
            <el-button type="primary" @click="addItem" size="small">新增</el-button>
        </div>
        <template v-if="fileContent?.playerentity?.['1']?.itemStorage?.count">
            <div>槽数：{{ fileContent?.playerentity?.['1']?.itemStorage?.count }}</div>
            <el-divider border-style="dashed" />
        </template>
        <template v-for="key in paginatedItems" :key="key">
            <div class="item-wrap">
                <div>槽位：{{ key }}</div>
                <div style="display: flex; align-items: center; gap: 10px; padding-top: 10px" v-for="subkey in Object.keys(itemObj[key])" :key="key + subkey">
                    <div style="width: 150px">{{ dictMap[subkey] ? `${dictMap[subkey].label}(${subkey})` : subkey }}</div>
                    <el-select-v2 class="item-edit" v-if="dictMap[subkey].type === 'select'" v-model="itemObj[key][subkey]" :options="itemOptions" filterable />
                    <el-switch class="item-edit" v-else-if="dictMap[subkey].type === 'boolean'" v-model="itemObj[key][subkey]" />
                    <el-input-number class="item-edit" v-else-if="dictMap[subkey].type === 'number'" v-model="itemObj[key][subkey]" />
                    <el-input class="item-edit" v-else v-model="itemObj[key][subkey]" />
                </div>
            </div>
            <el-divider border-style="dashed" />
        </template>
        <el-pagination v-if="Object.keys(itemObj).length" class="page-wrap" v-model:current-page="currentPage" v-model:page-size="pageSize" @current-change="handlePageChange" layout="prev, pager, next" :total="Object.keys(itemObj).length" />
    </div>
    <el-dialog v-model="dialogVisible" title="新增" width="90vw" top="10px" class="dialog-wrap">
        <el-form :model="form" label-width="auto">
            <el-form-item v-for="key in Object.keys(dictMap)" :key="key" :label="dictMap[key].label">
                <el-select-v2 class="item-edit" v-if="dictMap[key].type === 'select'" v-model="form[key]" :options="itemOptions" filterable />
                <el-switch class="item-edit" v-else-if="dictMap[key].type === 'boolean'" v-model="form[key]" />
                <el-input-number class="item-edit" v-else-if="dictMap[key].type === 'number'" v-model="form[key]" />
                <el-input class="item-edit" v-else v-model="form[key]" />
            </el-form-item>
        </el-form>
        <div class="dialog-footer">
            <el-button @click="dialogVisible = false">取消</el-button>
            <el-button type="primary" @click="saveItem">确认</el-button>
        </div>
    </el-dialog>
</template>

<style scoped lang="scss">
.container {
    padding: 10px;
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
    width: 100%;
}
.dialog-footer {
    display: flex;
    justify-content: flex-end;
}
</style>
