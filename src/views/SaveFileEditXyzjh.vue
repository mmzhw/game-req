<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, nextTick } from 'vue'
import axios from 'axios'
import { cloneDeep } from 'lodash'
import { ElLoading, ElMessage } from 'element-plus'
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
    12: { label: '装备属性', type: 'input' },
    14: { label: '词条属性', type: 'input' }
}

// 自动解析并添加未知的key到dictMap
const parseUnknownKeys = (data: any) => {
    if (!data) return
    Object.keys(data).forEach((key) => {
        const item = data[key]
        if (item && typeof item === 'object') {
            Object.keys(item).forEach((subkey) => {
                if (!dictMap[subkey]) {
                    // 根据值类型推断type
                    const value = item[subkey]
                    let type = 'input'
                    if (typeof value === 'number') {
                        type = 'number'
                    } else if (typeof value === 'boolean') {
                        type = 'boolean'
                    }
                    dictMap[subkey] = { label: subkey, type, unknown: true }
                }
                if (typeof data[key][subkey] === 'string') {
                    try {
                        const parsed = JSON.parse(data[key][subkey])
                        // 如果是数组,每个对象元素单独一行展示
                        if (Array.isArray(parsed)) {
                            // 将每个对象格式化为单行,冒号后加空格
                            const formattedItems = parsed.map((item: any) => {
                                return JSON.stringify(item).replace(/:/g, ':  ').replace(/,/g, ',  ').replace(/{/g, '  {  ').replace(/}/g, '  }')
                            })
                            data[key][subkey] = '[\n  ' + formattedItems.join(',\n  ') + '\n]'
                        } else {
                            data[key][subkey] = JSON.stringify(parsed, null, 4)
                        }
                    } catch (error) {
                        console.log(error)
                    }
                }
            })
        }
    })
}

let fileContent = ref<any>({})
const originalFilename = ref('')

const itemObj = ref<any>({})
const currentPage = ref(1)
const pageSize = ref(10) // 每页显示10个条目
const searchKey = ref('')
const filterKey = ref('') // 用于过滤的搜索关键词

const mValueBase = ref<any>({})

const fileLoaded = ref(false)

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

            Object.keys(fileContent.value.playerentity['1'].itemStorage.content).forEach((key: any) => {
                if (fileContent.value.playerentity['1'].itemStorage.content[key][12]) {
                    fileContent.value.playerentity['1'].itemStorage.content[key][12] = JSON.stringify(JSON.parse(fileContent.value.playerentity['1'].itemStorage.content[key][12]))
                }
                if (fileContent.value.playerentity['1'].itemStorage.content[key][14]) {
                    fileContent.value.playerentity['1'].itemStorage.content[key][14] = JSON.stringify(JSON.parse(fileContent.value.playerentity['1'].itemStorage.content[key][14]))
                }
            })
            itemObj.value = fileContent.value.playerentity['1'].itemStorage.content
            console.log(itemObj.value)
            mValueBase.value = JSON.parse(fileContent.value.playerentity['1'].m_valueBase)
            // 解析未知的key
            parseUnknownKeys(itemObj.value)
            console.log(fileContent.value.playerentity['1'])
            fileLoaded.value = true
        } catch (error) {
            console.log(error)
        }
        loading.close()
    }
    reader.readAsText(file.raw)
}
const saveFile = () => {
    function parseCommentedJSObject(str: string): any {
        try {
            // 1. 去掉单行注释
            const cleaned = str.replace(/\/\/.*$/gm, '')

            // 2. 给 key 加双引号
            const jsonStr = cleaned.replace(/(\w+)\s*:/g, '"$1":')

            // 3. 解析
            return JSON.parse(jsonStr)
        } catch (error) {
            console.error('解析失败:', error)
            throw new Error('无法解析该字符串为 JSON')
        }
    }

    let temp = cloneDeep(itemObj.value)
    Object.keys(temp).forEach((key: any) => {
        if (temp[key][12]) {
            temp[key][12] = JSON.stringify(JSON.parse(temp[key][12]))
        }
        if (temp[key][14]) {
            temp[key][14] = JSON.stringify(parseCommentedJSObject(temp[key][14]))
        }
    })

    fileContent.value.playerentity['1'].itemStorage.content = temp
    fileContent.value.playerentity['1'].m_valueBase = JSON.stringify(mValueBase.value)
    downloadFile(fileContent.value, originalFilename.value)
}

// 触发搜索过滤
const triggerSearch = () => {
    filterKey.value = searchKey.value
}

// 计算过滤后的所有项目键
const filteredKeys = computed(() => {
    let keys = Object.keys(itemObj.value)

    // 如果有搜索关键词，则过滤匹配的项目
    if (filterKey.value) {
        keys = keys.filter((key) => {
            const item = itemObj.value[key]
            // 检查是否有key为1的属性（物品代码）
            if (item && item['1'] !== undefined) {
                // 在itemOptions中查找对应value的项
                const matchedOption: any = itemOptions.value.find((option: any) => option.value === Number(item['1']))
                // 如果找到匹配项且其label包含搜索关键词，则返回true
                if (matchedOption && matchedOption.label.toLowerCase().includes(filterKey.value.toLowerCase())) {
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
const isMobile = ref(false)

// 检测是否为移动端
const checkMobile = () => {
    isMobile.value = window.innerWidth <= 768
}

onMounted(async () => {
    let response = await axios.get('db1_parsed.json')
    itemOptions.value = response.data || []

    // 初始化检测
    checkMobile()
    // 监听窗口大小变化
    window.addEventListener('resize', checkMobile)
})

const dialogVisible = ref(false)

// 根据内容计算 textarea 的行数
const getRows = (value: any) => {
    if (!value || typeof value !== 'string') return 2
    const lines = value.split('\n')
    return Math.max(2, lines.length)
}

// 根据物品ID获取物品名称
const getItemName = (itemId: number) => {
    const item: any = itemOptions.value.find((option: any) => option.value === itemId)
    return item ? item.label : '未知物品'
}

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

// 获取下一个可用的槽位key
const getNextKey = () => {
    const keys = Object.keys(itemObj.value)
    if (keys.length === 0) return '1'
    const lastKey = Math.max(...keys.map((k) => Number(k)))
    return String(lastKey + 1)
}

// 批量添加物品
const addItemsBatch = (itemCodes: number[], quantity: number = 1) => {
    itemCodes.forEach((code) => {
        const nextKey = getNextKey()
        itemObj.value[nextKey] = {
            '1': code,
            '2': quantity // 默认数量为1，可自定义
        }
        fileContent.value.playerentity['1'].itemStorage.count++
    })
    fileContent.value.playerentity['1'].itemStorage.content = itemObj.value
}

// 一键添加所有化境卷
const addhjj = () => {
    const hjjCodes = itemOptions.value.filter((item: any) => item.label.includes('化境卷')).map((item: any) => item.value)

    if (hjjCodes.length === 0) {
        ElMessage.warning('未找到化境卷物品')
        return
    }

    addItemsBatch(hjjCodes)
    ElMessage.success(`成功添加 ${hjjCodes.length} 个化境卷`)
}

// 一键添加所有技能卷
const addjnj = () => {
    const jnjCodes = itemOptions.value.filter((item: any) => item.label.includes('技能卷')).map((item: any) => item.value)

    if (jnjCodes.length === 0) {
        ElMessage.warning('未找到技能卷物品')
        return
    }

    addItemsBatch(jnjCodes)
    ElMessage.success(`成功添加 ${jnjCodes.length} 个技能卷`)
}

// 一键添加所有配方
const addpf = () => {
    const pfCodes = itemOptions.value.filter((item: any) => item.label.includes('配方') && item.value >= 1000 && item.value < 1100).map((item: any) => item.value)

    if (pfCodes.length === 0) {
        ElMessage.warning('未找到配方物品')
        return
    }

    addItemsBatch(pfCodes)
    ElMessage.success(`成功添加 ${pfCodes.length} 个配方`)
}

// 一键添加所有宝册（数量999）
const addbc = () => {
    const bcCodes = itemOptions.value.filter((item: any) => item.label.includes('宝册')).map((item: any) => item.value)

    if (bcCodes.length === 0) {
        ElMessage.warning('未找到宝册物品')
        return
    }

    addItemsBatch(bcCodes, 999)
    ElMessage.success(`成功添加 ${bcCodes.length} 个宝册（数量999）`)
}

// 一键添加所有书籍
const addsj = () => {
    // 定义书籍前缀列表
    const bookPrefixes = ['道学·', '佛学·', '儒学·', '墨学·', '农学·', '琴艺·', '棋艺·', '书法·', '画道·', '酒量·', '悟性·', '魔学·', '垂钓·']

    const sjCodes = itemOptions.value.filter((item: any) => bookPrefixes.some((prefix) => item.label.startsWith(prefix))).map((item: any) => item.value)

    if (sjCodes.length === 0) {
        ElMessage.warning('未找到书籍物品')
        return
    }

    addItemsBatch(sjCodes, 1)
    ElMessage.success(`成功添加 ${sjCodes.length} 个书籍`)
}

// 一键添加所有秘法
const addmf = () => {
    const mfCodes = itemOptions.value.filter((item: any) => item.label.startsWith('秘法：')).map((item: any) => item.value)

    if (mfCodes.length === 0) {
        ElMessage.warning('未找到秘法物品')
        return
    }

    addItemsBatch(mfCodes, 1)
    ElMessage.success(`成功添加 ${mfCodes.length} 个秘法`)
}

// 快速设置物品数量
const setItem = (key: string, quantity: number) => {
    if (itemObj.value[key]) {
        itemObj.value[key]['2'] = quantity
        ElMessage.success(`槽位 ${key} 数量已设置为 ${quantity}`)
    }
}
</script>

<template>
    <el-upload v-if="!fileLoaded" class="upload-demo" drag action="#" :on-change="handleFileSelect" :auto-upload="false" :show-file-list="false">
        <el-icon class="el-icon--upload">
            <upload-filled />
        </el-icon>
        <div class="el-upload__text">Drop file here or <em>click to upload</em></div>
    </el-upload>
    <el-button class="save-button-wrap" v-if="fileLoaded" type="primary" @click="saveFile">保存</el-button>

    <el-scrollbar v-if="fileLoaded" style="height: calc(100vh - 85px); padding: 10px 0">
        <div class="container">
            <template>
                <div style="display: flex; gap: 10px; flex-direction: column">
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
                </div>
                <el-divider border-style="dashed" />
                <div style="display: flex; align-items: center; flex-wrap: wrap; gap: 10px">
                    <el-button style="margin: 0" type="primary" @click="addpf">配方</el-button>
                    <el-button style="margin: 0" type="primary" @click="addbc">宝册</el-button>
                    <el-button style="margin: 0" type="primary" @click="addsj">书籍</el-button>
                    <el-button style="margin: 0" type="primary" @click="addhjj">化境卷</el-button>
                    <el-button style="margin: 0" type="primary" @click="addjnj">技能卷</el-button>
                    <el-button style="margin: 0" type="primary" @click="addmf">秘法</el-button>
                </div>
                <el-divider border-style="dashed" />
                <div style="display: flex; align-items: center; padding-bottom: 10px; gap: 10px">
                    <el-button type="primary" @click="addItem">新增</el-button>
                    <el-input v-model="searchKey" placeholder="输入物品名称搜索" @keyup.enter="triggerSearch" @blur="triggerSearch">
                        <template #append>槽数：{{ fileContent?.playerentity?.['1']?.itemStorage?.count }}</template>
                    </el-input>
                </div>
            </template>
            <template v-for="(key, index) in paginatedItems" :key="key">
                <div class="item-wrap" :class="{ 'item-bg': index % 2 === 0 }">
                    <div class="item-flex">
                        <div class="label">槽位：</div>
                        <div style="flex: 1">{{ key }}</div>
                        <el-button size="small" @click="setItem(key, 99)">99</el-button>
                        <el-button size="small" @click="setItem(key, 999)">999</el-button>
                        <el-button size="small" @click="setItem(key, 9999)">9999</el-button>
                        <el-button size="small" @click="editItem(key)">编辑</el-button>
                    </div>
                    <template v-for="subkey in Object.keys(itemObj[key])" :key="key + subkey">
                        <div class="item-flex" v-if="!dictMap?.[subkey]?.unknown">
                            <div class="label">{{ dictMap[subkey].label }}：</div>
                            <div class="item-edit" v-if="dictMap[subkey] && dictMap[subkey].type === 'select'">{{ getItemName(itemObj[key][subkey]) }}</div>
                            <el-switch class="item-edit" v-else-if="dictMap[subkey] && dictMap[subkey].type === 'boolean'" v-model="itemObj[key][subkey]" />
                            <el-input-number class="item-edit" v-else-if="dictMap[subkey] && dictMap[subkey].type === 'number'" v-model="itemObj[key][subkey]" />
                            <el-input class="item-edit" v-else v-model="itemObj[key][subkey]" :rows="getRows(itemObj[key][subkey])" type="textarea" />
                        </div>
                    </template>
                </div>
            </template>
        </div>
    </el-scrollbar>

    <el-pagination v-if="Object.keys(itemObj).length" class="page-wrap" background v-model:current-page="currentPage" v-model:page-size="pageSize" @current-change="handlePageChange" layout="prev, pager, next, total" :total="filteredKeys.length" :pager-count="isMobile ? 5 : 7" size="small" />
    <el-dialog v-model="dialogVisible" title="新增/编辑" width="90vw" top="10px" class="dialog-wrap">
        <el-form :model="form" label-width="auto">
            <el-form-item v-for="key in Object.keys(dictMap)" :key="key" :label="dictMap[key].label">
                <el-select-v2 class="item-edit" v-if="dictMap[key].type === 'select'" v-model="form[key]" :options="itemOptions" filterable />
                <el-switch class="item-edit" v-else-if="dictMap[key].type === 'boolean'" v-model="form[key]" />
                <el-input-number class="item-edit" v-else-if="dictMap[key].type === 'number'" v-model="form[key]" />
                <el-input class="item-edit" v-else v-model="form[key]" :rows="getRows(form[key])" type="textarea" />
            </el-form-item>
        </el-form>
        <div class="dialog-footer">
            <el-button @click="dialogVisible = false">取消</el-button>
            <el-button type="primary" @click="saveItem">确认</el-button>
        </div>
    </el-dialog>
</template>

<style scoped lang="scss">
.upload-demo {
    padding: 10px;
}
.save-button-wrap {
    width: calc(100% - 20px);
    box-sizing: border-box;
    margin: 10px 10px 0 10px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    z-index: 100;
}
.container {
    width: calc(100% - 20px);
    margin: 0 10px 0 10px;
    box-sizing: border-box;
    position: relative;
    > div {
        width: 100%;
    }
}
.item-edit {
    width: 100%;
}
.page-wrap {
    width: 100%;
    background-color: #fff;
    padding: 10px;
    box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
    z-index: 100;
    :deep() {
    }
}
.dialog-footer {
    display: flex;
    justify-content: flex-end;
}
.item-flex {
    display: flex;
    align-items: center;
    gap: 10px;
    > .label {
        width: 75px;
        flex-shrink: 0;
    }
    > .item-edit {
        flex: 1;
    }
    :deep() {
        .el-button {
            margin: 0;
        }
    }
}

.item-wrap {
    padding: 10px;
    border-radius: 4px;
    gap: 10px;
    display: flex;
    flex-direction: column;
}
.item-bg {
    background-color: #f5f7fa;
}
:deep() {
    .el-divider {
        margin: 15px 0;
    }
}
</style>
