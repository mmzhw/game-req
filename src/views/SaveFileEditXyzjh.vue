<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import axios from 'axios'
import { cloneDeep, debounce } from 'lodash'
import { ElLoading } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import { downloadFile } from '@/utils/download-file'

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

let fileContent = ref<any>({})
const originalFilename = ref('')

const itemObj = ref<any>({})
const currentPage = ref(1)
const pageSize = ref(10) // 每页显示10个条目
const searchKey = ref('')
const debouncedSearchKey = ref('') // 新增防抖后的搜索关键词

const mValueBase = ref<any>({})

const handleFileSelect = (file: any) => {
    const loading = ElLoading.service({
        lock: true,
        text: 'Loading',
        background: 'rgba(0, 0, 0, 0.7)'
    })
    console.log('file', file)
    // 记录原始文件名
    originalFilename.value = file.name

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
        loading.close()
    }
    reader.readAsText(file.raw)
}
const saveFile = () => {
    fileContent.value.playerentity['1'].itemStorage.content = itemObj.value
    fileContent.value.playerentity['1'].m_valueBase = JSON.stringify(mValueBase.value)
    downloadFile(fileContent.value, originalFilename.value)
}

// 创建防抖函数
const debouncedUpdateSearch = debounce((newValue) => {
    debouncedSearchKey.value = newValue
}, 300)

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
                const matchedOption: any = itemOptions.value.find((option: any) => option.value === Number(item['1']))
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

const handlePageChange = (page: number) => {
    currentPage.value = page
}

const itemOptions = ref([])
onMounted(async () => {
    let response = await axios.get('db1_parsed.json')
    itemOptions.value = response.data || []
})

const dialogVisible = ref(false)

const editKey = ref<any>(null)
const form = ref<any>({})
const addItem = () => {
    editKey.value = null
    Object.keys(dictMap).forEach((key) => {
        if (['number', 'select'].includes(dictMap[key].type)) {
            form.value[key] = null
        } else if (dictMap[key].type === 'boolean') {
            form.value[key] = false
        } else {
            form.value[key] = ''
        }
    })
    dialogVisible.value = true
}
const editItem = (key: any) => {
    editKey.value = key
    let temp = cloneDeep(itemObj.value[key])
    Object.keys(dictMap).forEach((key) => {
        if (['number', 'select'].includes(dictMap[key].type)) {
            form.value[key] = null
        } else if (dictMap[key].type === 'boolean') {
            form.value[key] = false
        } else {
            form.value[key] = ''
        }
    })
    Object.keys(temp).forEach((key) => {
        form.value[key] = temp[key]
    })
    dialogVisible.value = true
}
const saveItem = () => {
    let item = cloneDeep(form.value)
    Object.keys(item).forEach((key) => {
        if (!item[key]) {
            delete item[key]
        }
    })

    if (!editKey.value) {
        let keys = Object.keys(itemObj.value)
        let lastKey = keys[keys.length - 1]
        itemObj.value[Number(lastKey) + 1] = item
        fileContent.value.playerentity['1'].itemStorage.count++
        fileContent.value.playerentity['1'].itemStorage.content = itemObj.value
    } else {
        itemObj.value[editKey.value] = item
    }
    dialogVisible.value = false
}
</script>

<template>
    <div class="container">
        <el-upload class="upload-demo" drag action="#" :on-change="handleFileSelect" :auto-upload="false" :show-file-list="false">
            <el-icon class="el-icon--upload">
                <upload-filled />
            </el-icon>
            <div class="el-upload__text">Drop file here or <em>click to upload</em></div>
        </el-upload>
        <el-button type="primary" @click="saveFile">保存</el-button>
        <div class="item-flex">
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
            <el-button type="primary" @click="addItem">新增</el-button>
            <el-input v-model="searchKey" placeholder="输入物品名称搜索">
                <template #append>槽数：{{ fileContent?.playerentity?.['1']?.itemStorage?.count }}</template>
            </el-input>
        </div>
        <template v-for="key in paginatedItems" :key="key">
            <div class="item-wrap">
                <div class="item-flex">
                    <div class="label">槽位</div>
                    <div style="flex: 1">{{ key }}</div>
                    <el-button size="small" @click="editItem(key)">编辑</el-button>
                </div>
                <div class="item-flex" v-for="subkey in Object.keys(itemObj[key])" :key="key + subkey">
                    <div class="label">{{ dictMap[subkey] ? `${dictMap[subkey].label}(${subkey})` : subkey }}</div>
                    <el-select-v2 class="item-edit" v-if="dictMap[subkey].type === 'select'" v-model="itemObj[key][subkey]" :options="itemOptions" filterable />
                    <el-switch class="item-edit" v-else-if="dictMap[subkey].type === 'boolean'" v-model="itemObj[key][subkey]" />
                    <el-input-number class="item-edit" v-else-if="dictMap[subkey].type === 'number'" v-model="itemObj[key][subkey]" />
                    <el-input class="item-edit" v-else v-model="itemObj[key][subkey]" />
                </div>
            </div>
            <el-divider border-style="dashed" />
        </template>
        <el-pagination v-if="Object.keys(itemObj).length" class="page-wrap" v-model:current-page="currentPage" v-model:page-size="pageSize" @current-change="handlePageChange" layout="prev, pager, next, total" :total="filteredKeys.length" />
    </div>
    <el-dialog v-model="dialogVisible" title="新增/编辑" width="90vw" top="10px" class="dialog-wrap">
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
    width: 100%;
    box-sizing: border-box;
    > div {
        width: 100%;
    }
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
    > .label {
        width: 100px;
        flex-shrink: 0;
    }
    > .item-edit {
        flex: 1;
    }
}
.upload-demo {
    padding-bottom: 10px;
}
</style>
