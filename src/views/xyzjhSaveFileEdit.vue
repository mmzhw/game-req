<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import { cloneDeep, debounce } from 'lodash'

const dictMap: any = {
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
const searchKey = ref('')
const debouncedSearchKey = ref('') // 新增防抖后的搜索关键词

const mValueBase = ref({})

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
                mValueBase.value = JSON.parse(fileContent.value.playerentity['1'].m_valueBase)
                console.log(fileContent.value.playerentity['1'])
            } catch (error) {
                console.log(error)
            }
        }
        reader.onerror = () => {}
        reader.readAsText(files[0])
    }
}

// 创建防抖函数
const debouncedUpdateSearch = debounce((newValue) => {
    debouncedSearchKey.value = newValue
}, 500)

// 添加防抖逻辑
watch(searchKey, (newValue) => {
    debouncedUpdateSearch(newValue)
})

// 计算过滤后的所有项目键
const filteredKeys = computed(() => {
    let keys = Object.keys(itemObj.value)

    // 如果有搜索关键词，则过滤匹配的项目
    if (debouncedSearchKey.value) {
        keys = keys.filter((key) => {
            const item = itemObj.value[key]
            // 检查是否有key为1的属性（物品代码）
            if (item && item['1'] !== undefined) {
                // 在itemOptions中查找对应value的项
                const matchedOption = itemOptions.value.find((option) => option.value === Number(item['1']))
                // 如果找到匹配项且其label包含搜索关键词，则返回true
                if (matchedOption && matchedOption.label.toLowerCase().includes(debouncedSearchKey.value.toLowerCase())) {
                    return true
                }
            }
            return false
        })
    }

    return keys
})

// 获取当前页的数据
const paginatedItems = computed(() => {
    const startIndex = (currentPage.value - 1) * pageSize.value
    const endIndex = startIndex + pageSize.value
    return filteredKeys.value.slice(startIndex, endIndex)
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
    fileContent.value.playerentity['1'].m_valueBase = JSON.stringify(mValueBase.value)

    // 将修改后的数据转换为JSON字符串
    const jsonData = JSON.stringify(fileContent.value, null, 2)

    // 创建Blob对象
    const blob = new Blob([jsonData], { type: 'application/json' })

    // 创建下载链接
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url

    // 使用原始文件名，如果没有则使用默认名称
    a.download = originalFilename.value

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
        <div class="item-flex" style="padding-top: 0">
            <p style="width: 50px">金钱</p>
            <el-input-number class="item-edit" v-model="mValueBase[68]" />
        </div>
        <div class="item-flex">
            <p style="width: 50px">修为</p>
            <el-input-number class="item-edit" v-model="mValueBase[69]" />
        </div>
        <div class="item-flex">
            <p style="width: 50px">感悟</p>
            <el-input-number class="item-edit" v-model="mValueBase[70]" />
        </div>
        <el-divider border-style="dashed" />
        <div style="display: flex; align-items: center; padding-bottom: 10px; gap: 10px">
            <el-input v-model="searchKey" placeholder="输入物品名称搜索" />
            <div style="flex-shrink: 0" v-if="fileContent?.playerentity?.['1']?.itemStorage?.count">槽数：{{ fileContent?.playerentity?.['1']?.itemStorage?.count }}</div>
        </div>
        <template v-for="key in paginatedItems" :key="key">
            <div class="item-wrap">
                <div>槽位：{{ key }}</div>
                <div class="item-flex" v-for="subkey in Object.keys(itemObj[key])" :key="key + subkey">
                    <div style="width: 150px">{{ dictMap[subkey] ? `${dictMap[subkey].label}(${subkey})` : subkey }}</div>
                    <el-select-v2 class="item-edit" v-if="dictMap[subkey].type === 'select'" v-model="itemObj[key][subkey]" :options="itemOptions" filterable />
                    <el-switch class="item-edit" v-else-if="dictMap[subkey].type === 'boolean'" v-model="itemObj[key][subkey]" />
                    <el-input-number class="item-edit" v-else-if="dictMap[subkey].type === 'number'" v-model="itemObj[key][subkey]" />
                    <el-input class="item-edit" v-else v-model="itemObj[key][subkey]" />
                </div>
            </div>
            <el-divider border-style="dashed" />
        </template>
        <el-pagination v-if="Object.keys(itemObj).length" class="page-wrap" v-model:current-page="currentPage" v-model:page-size="pageSize" @current-change="handlePageChange" layout="prev, pager, next" :total="filteredKeys.length" />
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
.item-flex {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-top: 10px;
}
</style>
