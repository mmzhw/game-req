<template>
    <el-checkbox-group
        :class="['check-group-wrap', isMobile && 'mobileCheck', props.checkboxType !== 'button' && 'boxLine', props.maxHeight && 'maxHeight']"
        v-model="realItem"
        @change="changeItemId"
    >
        <template v-if="props.checkboxType === 'button'">
            <el-checkbox-button v-for="(item, index) in realList" :key="index" :value="item" :title="item.name">{{ item.name }}</el-checkbox-button>
        </template>
        <template v-else>
            <el-checkbox v-for="(item, index) in realList" :key="index" :value="item" :title="item.name">{{ item.name }}</el-checkbox>
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
            :total="dataList?.length"
            :current-page="current"
            @current-change="pageCurrentChange"
            @size-change="pageSizeChange"
        >
            <template #default><span style="padding-left: 5px">{{ current }} / {{ Math.ceil(dataList?.length / size) }}页</span></template>
        </el-pagination>
    </div>

</template>

<script lang="ts" setup>
import {computed, onMounted, ref, watch} from 'vue'

interface PropsRadioPagination {
    dataList: ItemsSingle[]
    currentItem: any
    routeType: string
    checkboxType: string
    pageSize: number
    maxHeight: string
}

const props = withDefaults(defineProps<PropsRadioPagination>(), {
    dataList: () => [],
    currentItem: () => [],
    routeType: '',
    checkboxType: 'button',
    pageSize: 10,
    maxHeight: ''
})

const emit = defineEmits(['update:currentItem'])

const size = ref(props.pageSize)
const sizes = ref([10, 20, 50, 100, 200, 300, 400, 500, 1000, 5000])
const current = ref(1)
const layout = ref('')
const realItem = ref([])

const isMobile = ref(/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent))

let realList = computed(() => {
    return props.dataList?.slice(size.value * (current.value - 1), size.value * current.value)
})
watch(
    () => props.currentItem,
    (newVal: any, oldVal: any) => {
        realItem.value = newVal
    },
    {deep: true}
)
onMounted(() => {
    if (isMobile.value) {
        layout.value = 'prev, next, jumper, sizes, ->, slot'
    } else {
        layout.value = 'total, prev, pager, next, jumper, sizes, ->, slot'
    }
})

const pageCurrentChange = (s: number) => {
    current.value = s
}

const pageSizeChange = (sizes: number) => {
    size.value = sizes
    current.value = 1
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
</style>
