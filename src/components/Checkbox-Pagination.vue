<template>
    <el-checkbox-group
        :class="['check-group-wrap', isMobile && 'mobileCheck', props.checkboxType !== 'button' && 'boxLine', props.maxHeight && 'maxHeight']"
        v-model="realItem"
        @change="changeItemId"
    >
        <template v-if="props.checkboxType === 'button'">
            <el-checkbox-button v-for="(item, index) in realList" :key="index" :value="item" :title="item.name + '（' + item.value + '）'">{{ item.name }}（{{ item.value }}）</el-checkbox-button>
        </template>
        <template v-else>
            <el-checkbox v-for="(item, index) in realList" :key="index" :value="item" :title="item.name + '（' + item.value + '）'">{{ item.name }}（{{ item.value }}）</el-checkbox>
        </template>
    </el-checkbox-group>
    <div :style="{display: 'flex', alignItems: 'center', marginBottom: isMobile ? '10px' : ''}">
        <el-button type="text" @click="clickAll" style="margin-right: 10px">全选</el-button>
        <el-pagination
            class="pagePaginationWrap"
            background
            hide-on-single-page
            :class="isMobile && 'pagePaginationMobile'"
            :layout="layout"
            :page-sizes="sizes"
            :page-size="size"
            :total="total"
            :current-page="current"
            @current-change="pageCurrentChange"
            @size-change="pageSizeChange"
        >
            <template #default><span style="padding-left: 5px">{{ current }} / {{ Math.max(1, Math.ceil(total / size)) }}页</span></template>
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
<style scoped src="../assets/game-req.scss"></style>
<style scoped lang="scss">
.check-group-wrap {
    :deep() {
        .el-checkbox-button {
            margin: 0 0 5px 0;
        }

        .el-checkbox {
            width: 22%;
            display: inline-flex;

            span:nth-child(1) {
                display: block;
            }

            span:nth-child(2) {
                display: block;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
        }

    }
}

.mobileCheck {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;

    :deep() {
        .el-checkbox-button {
            width: calc((100% - 10px) / 2);

            .el-checkbox-button__inner {
                width: 100%;
                font-size: 12px;
                border-radius: 4px !important;
                border: 1px solid #dcdfe6 !important;
            }
        }

        .el-checkbox {
            width: 100%;
        }
    }
}

.boxLine {
    border: 1px solid #cccccc;
    padding: 0 10px;
    margin-bottom: 10px;
}

.pagePaginationWrap {
    :deep() {
        .el-pagination__jump{
            margin-left: 2px;
        }
    }
}

.pagePaginationMobile {
    :deep() {
        .el-pagination__sizes {
            margin-left: 5px;

            .el-select {
                width: 85px;
            }

            .el-select__wrapper {
                padding: 4px 6px;
            }
        }
        .el-pagination__editor.el-input {
            width: 40px;
        }
        .el-input__wrapper{
            //padding: 0 2px;
            padding: 0;
        }
    }
}

.maxHeight {
    max-height: 50vh;
    overflow: auto;
}

@media (max-width: 700px) {
    .check-group-wrap {
        padding: 8px;

        :deep(.el-checkbox) {
            width: 100%;
            margin-right: 0;
        }
    }

    .pagePaginationWrap {
        flex: 1;
        min-width: 0;
        overflow-x: auto;
        padding-bottom: 4px;
    }
}
</style>
