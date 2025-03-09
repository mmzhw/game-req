<template>
    <el-checkbox-group
        :class="['check-group-wrap', isMobile && 'mobileCheck', props.checkboxType !== 'button' && 'boxLine', props.maxHeight && 'maxHeight']"
        v-model="realItem"
        @change="changeItemId"
    >
        <template v-if="props.checkboxType === 'button'">
            <el-checkbox-button v-for="(item, index) in realList" :key="index" :value="item">{{ item.name }}</el-checkbox-button>
        </template>
        <template v-else>
            <el-checkbox v-for="(item, index) in realList" :key="index" :value="item">{{ item.name }}</el-checkbox>
        </template>
    </el-checkbox-group>
    <el-pagination class="marginBottomTen" background :class="isMobile && 'pagePaginationMobile'" :layout="layout" :page-sizes="sizes" :total="dataList?.length" :page-size="size" :current-page="current" @current-change="pageCurrentChange" @size-change="pageSizeChange">
        <template #default
            ><span>{{ current }}页 / {{ dataList?.length }}条</span></template
        >
    </el-pagination>
</template>

<script lang="ts" setup>
import { computed, onMounted, ref, watch } from 'vue'

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
const sizes = ref([10, 20, 50, 100, 1000, 5000])
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
    { deep: true }
)
onMounted(() => {
    if (isMobile.value) {
        layout.value = 'prev, next, sizes, ->, slot'
    } else {
        layout.value = 'prev, pager, next, jumper, sizes, ->, total'
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
</script>
<style scoped src="../assets/game-req.scss"></style>
<style scoped lang="scss">
.check-group-wrap {
    :deep {
        .el-checkbox-button {
            margin: 0 0 5px 0;
        }
        .el-checkbox{
            width: 20%;
        }
    }
}

.mobileCheck {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;

    :deep {
        .el-checkbox-button {
            width: calc((100% - 10px) / 2);

            .el-checkbox-button__inner {
                width: 100%;
                font-size: 12px;
                border-radius: 4px !important;
                border: 1px solid #dcdfe6 !important;
            }
        }
        .el-checkbox{
            width: 100%;
        }
    }
}

.boxLine {
    border: 1px solid #cccccc;
    padding: 0 10px;
    margin-bottom: 10px;
}

.pagePaginationMobile {
    :deep {
        .el-pagination__sizes {
            margin-left: 5px;
            .el-select{
                width: 100px;
            }
            .el-select__wrapper{
                padding: 4px 6px;
            }
        }
    }
}

.maxHeight{
    max-height: 50vh;
    overflow: auto;
}
</style>
