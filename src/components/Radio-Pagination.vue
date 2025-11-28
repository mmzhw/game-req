<template>
    <el-radio-group
        class="marginTopFive"
        :class="isMobile && 'mobileRadio'"
        v-model="realItem"
        @change="changeItemId"
    >
        <el-radio-button v-for="(item, index) in realList" :key="index" :label="item.value"
            >{{ item.name }}
        </el-radio-button>
    </el-radio-group>
    <el-pagination
        class="marginBottomTen"
        :class="isMobile && 'pagePaginationMobile'"
        :layout="layout"
        :page-sizes="sizes"
        :total="dataList?.length"
        :page-size="size"
        :current-page="current"
        @current-change="pageCurrentChange"
        @size-change="pageSizeChange"
    >
        <template #default
            ><span>{{ current }}页 / {{ dataList?.length }}条</span></template
        >
    </el-pagination>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, watch } from 'vue'

interface PropsRadioPagination {
    dataList: ItemsSingle[]
    currentItem: string
    routeType: string
}
const props = withDefaults(defineProps<PropsRadioPagination>(), {
    dataList: () => [],
    currentItem: '',
    routeType: ''
})

const emit = defineEmits(['update:currentItem'])

const size = ref(10)
const sizes = ref([10, 20, 50, 100, 200, 300, 400, 500, 1000, 5000])
const current = ref(1)
const layout = ref('')
const realItem = ref('')

const isMobile = ref(/mobile/i.test(navigator.userAgent))

let realList = computed(() => {
    return props.dataList?.slice(size.value * (current.value - 1), size.value * current.value)
})
watch(
    () => props.currentItem,
    (newVal: string, oldVal: string) => {
        if (newVal !== oldVal) {
            realItem.value = newVal
        }
    }
)
onMounted(() => {
    if (isMobile.value) {
        layout.value = 'prev, next, sizes, ->, slot'
    } else {
        layout.value = 'prev, pager, next, jumper, sizes, ->, total'
    }
})

const pageCurrentChange = (size: number) => {
    current.value = size
}

const pageSizeChange = (sizes: number) => {
    size.value = sizes
    current.value = 1
}

const changeItemId = (item: string) => {
    window.localStorage.setItem(props.routeType + 'itemId', item)
    emit('update:currentItem', item)
}
</script>
<style scoped src="../assets/game-req.scss"></style>
<style scoped lang="scss">
.mobileRadio {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;

    :deep() {
        .el-radio-button {
            width: calc((100% - 10px) / 2);
            margin: 0;

            .el-radio-button__inner {
                width: 100%;
                font-size: 12px;
                border-radius: 4px !important;
            }
        }
    }
}

.pagePaginationMobile {
    :deep() {
        .el-pagination__sizes {
            margin-left: 5px;
        }
    }
}
</style>
