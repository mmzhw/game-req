<template>
    <el-scrollbar :max-height="props.maxHeight || undefined">
        <el-checkbox-group
            :class="['check-group-wrap', props.checkboxType !== 'button' && 'boxLine']"
            v-model="realItem"
            @change="changeItemId"
        >
            <template v-if="props.checkboxType === 'button'">
                <el-checkbox-button v-for="(item, index) in realList" :key="index" :value="item" :title="item.name + '（' + item.value + '）'"><template v-for="(part, i) in nameParts(item.name)" :key="i"><mark v-if="i % 2" class="item-match">{{ part }}</mark><template v-else>{{ part }}</template></template>（{{ item.value }}）</el-checkbox-button>
            </template>
            <template v-else>
                <el-checkbox v-for="(item, index) in realList" :key="index" :value="item" :title="item.name + '（' + item.value + '）'"><template v-for="(part, i) in nameParts(item.name)" :key="i"><mark v-if="i % 2" class="item-match">{{ part }}</mark><template v-else>{{ part }}</template></template>（{{ item.value }}）</el-checkbox>
            </template>
        </el-checkbox-group>
    </el-scrollbar>
    <div class="selection-toolbar">
        <el-button class="select-all" type="text" @click="clickAll">全选</el-button>
        <el-pagination
            class="game-pagination"
            background
            hide-on-single-page
            :layout="layout"
            :page-sizes="sizes"
            :page-size="size"
            :total="total"
            :current-page="current"
            @current-change="pageCurrentChange"
            @size-change="pageSizeChange"
        >
            <template #default><span>{{ current }} / {{ Math.max(1, Math.ceil(total / size)) }}页</span></template>
        </el-pagination>
    </div>

</template>

<script lang="ts" setup>
import {computed, onMounted, onUnmounted, ref, watch} from 'vue'

interface PropsRadioPagination {
    dataList: ItemsSingle[]
    currentItem: any
    routeType: string
    checkboxType: string
    pageSize: number
    maxHeight: string
    remote: boolean
    remoteTotal: number
    highlightKeyword?: string
}

const props = withDefaults(defineProps<PropsRadioPagination>(), {
    dataList: () => [],
    currentItem: () => [],
    routeType: '',
    checkboxType: 'button',
    pageSize: 10,
    maxHeight: '',
    remote: false,
    remoteTotal: 0
})

const highlightPattern = computed(() => {
    const keyword = props.highlightKeyword?.trim()
    return keyword ? new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'iu') : null
})

const nameParts = (name: string) => {
    const pattern = highlightPattern.value
    return pattern ? name.split(pattern) : [name]
}

const emit = defineEmits(['update:currentItem', 'page-change', 'size-change'])

const size = ref(props.pageSize)
const sizes = ref([10, 20, 50, 100, 200, 300, 400, 500, 1000, 5000])
const current = ref(1)
const layout = ref('')
const realItem = ref([])

const mobileQuery = window.matchMedia('(max-width: 700px)')
const isMobile = ref(mobileQuery.matches)
const updateMobile = (event: MediaQueryListEvent) => { isMobile.value = event.matches }

let realList = computed(() => {
    return props.remote ? props.dataList : props.dataList?.slice(size.value * (current.value - 1), size.value * current.value)
})
const total = computed(() => (props.remote ? props.remoteTotal : props.dataList?.length || 0))
watch(
    () => props.currentItem,
    (newVal: any, oldVal: any) => {
        realItem.value = newVal
    },
    {deep: true}
)
onMounted(() => {
    mobileQuery.addEventListener('change', updateMobile)
})
onUnmounted(() => mobileQuery.removeEventListener('change', updateMobile))
watch(isMobile, (mobile) => {
    layout.value = mobile ? 'prev, next, jumper, sizes, ->, slot' : 'total, prev, pager, next, jumper, sizes, ->, slot'
}, { immediate: true })

const pageCurrentChange = (s: number) => {
    current.value = s
    emit('page-change', s)
}

const pageSizeChange = (pageSize: number) => {
    size.value = pageSize
    current.value = 1
    emit('size-change', pageSize)
}

const changeItemId = (item: []) => {
    window.localStorage.setItem(props.routeType + 'itemId', JSON.stringify(item))
    emit('update:currentItem', item)
}

const clickAll = () => {
    let list = JSON.parse(JSON.stringify(realItem.value))

    realList.value.forEach((i: ItemsSingle) => {
        let match: any = list.find((z: ItemsSingle) => z.name === i.name)
        if (!match) {
            list.push(i)
        }
    })
    window.localStorage.setItem(props.routeType + 'itemId', JSON.stringify(list))
    emit('update:currentItem', list)

}

defineExpose({
    updateSize: (currentPage: number) => {
        current.value = currentPage
    },
    getPageSize: () => {
        return size.value
    }
})
</script>
<style scoped lang="scss" src="../assets/game-req.scss"></style>
<style scoped lang="scss">
.item-match {
    border-radius: 2px;
    background: #fef0b8;
    color: #583c00;
}

.check-group-wrap {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 0;

    :deep(.el-checkbox-button) {
        min-width: 0;
        max-width: 100%;
    }

    :deep(.el-checkbox-button .el-checkbox-button__inner) {
        width: 100%;
        min-height: 34px;
        border: 1px solid var(--ui-border);
        border-radius: 6px;
        line-height: 1.4;
        white-space: normal;
        overflow-wrap: anywhere;
    }

    :deep(.el-checkbox-button.is-checked .el-checkbox-button__inner) {
        border-color: var(--ui-accent);
        background: var(--ui-accent-soft);
        color: var(--ui-accent);
        box-shadow: none;
    }
}

.boxLine {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 182px), 1fr));
    padding: 6px;
    border: 1px solid var(--ui-border);
    border-radius: var(--ui-radius);
    background: var(--ui-bg);

    :deep(.el-checkbox) {
        gap: 6px;
        min-width: 0;
        height: auto;
        min-height: 34px;
        margin: 0;
        padding: 5px 7px;
        border-radius: 5px;
        background: var(--ui-surface);
    }

    :deep(.el-checkbox.is-checked) {
        background: var(--ui-accent-soft);
    }

    :deep(.el-checkbox__label) {
        min-width: 0;
        padding-left: 0;
        line-height: 1.4;
        white-space: normal;
        overflow-wrap: anywhere;
    }
}

.selection-toolbar {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px 12px;
    margin-top: 8px;
}

.select-all {
    min-height: 36px;
    margin: 0;
    color: var(--ui-accent);
}

.game-pagination {
    flex: 1 1 0;
}

@media (max-width: 768px) {
    .selection-toolbar { align-items: flex-start; }
    .game-pagination { flex-basis: 100%; }

    .boxLine :deep(.el-checkbox),
    .check-group-wrap :deep(.el-checkbox-button .el-checkbox-button__inner) {
        min-height: 40px;
    }
}
</style>
