<template>
    <el-table :data="realList" style="width: 100%" border>
        <el-table-column prop="no" label="序号" width="80" />
        <el-table-column prop="message" label="内容" />
    </el-table>
    <el-pagination
        class="marginTopFive"
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
import { ref, computed, onMounted } from 'vue'

const props = defineProps<{
    dataList: Array<{ no: number; message: string }>
}>()

const size = ref(10)
const sizes = ref([10, 20, 50, 100, 1000, 5000])
const current = ref(1)
const layout = ref('')

const isMobile = ref(/mobile/i.test(navigator.userAgent))

let realList = computed(() => {
    return props.dataList?.slice(size.value * (current.value - 1), size.value * current.value)
})

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
</script>
<style scoped src="../assets/game-req.scss"></style>
<style scoped lang="scss">
.pagePaginationMobile {
    :deep {
        .el-pagination__sizes {
            margin-left: 5px;
        }
    }
}
</style>
