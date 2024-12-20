<template>
    <div class="flex-column">
        <div class="flex-column">
            <div class="flex-line" v-for="(item, index) in baseForm" :key="'base-form' + index">
                <label>{{ item.label }}：</label>
                <el-input v-model="item.value" @input="(value:string) => LSSaveValue(item.label, value)" />
            </div>
            <div class="flex-line">
                <label>已选：</label>
                <div style="line-height: 32px">
                    <template v-if="selectedItems?.length">
                        <el-tag class="marginRightFive" v-for="(i, index) in selectedItems" :key="'selected-good' + index" closable @close="clearSingleItem(i)">{{ i.name }}</el-tag>
                    </template>
                    <span v-else>暂未选择</span>
                </div>
            </div>
            <div class="flex-line">
                <label>过滤：</label>
                <div>
                    <el-input v-model="keyWord" placeholder="过滤" @input="changeWupin" />
                </div>
            </div>
            <div class="flex-line">
                <label>物品：</label>
                <div>
                    <checkbox-pagination :data-list="goodsList" v-model:currentItem="selectedItems" :routeType="routeType" :pageSize="50" checkboxType="default" />
                </div>
            </div>
            <div style="display: flex; padding-bottom: 10px">
                <el-button type="primary" @click="getGoods">发送</el-button>
                <el-button type="primary" @click="selectedItems = []">清空</el-button>
            </div>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
import CheckboxPagination from '../components/Checkbox-Pagination.vue'
import itemListing from '@/constant/djs'
import axios from 'axios'

const reqPre = import.meta.env.DEV ? 'http://localhost:3000' : ''

interface PropsRadioPagination {
    routeType: string
}
const props = withDefaults(defineProps<PropsRadioPagination>(), {
    routeType: 'djs',
})

const goodsList: any = ref(itemListing)
const selectedItems: any = ref([])
const keyWord: any = ref('')
const baseForm: any = ref([
    { label: '角色', value: window.localStorage.getItem(props.routeType + '角色') || '慕灵' },
    { label: '数量', value: window.localStorage.getItem(props.routeType + '数量') || '1' }
])

const LSSaveValue = (type: string, value: any) => {
    window.localStorage.setItem(props.routeType + type, String(value))
}
const changeWupin = (value: string) => {
    if (value) {
        goodsList.value = itemListing.filter((i: ItemsDjsSingle) => {
            return value && i.name.includes(value)
        })
    } else {
        goodsList.value = itemListing
    }
}
const clearSingleItem = (i: ItemsDjsSingle) => {
    selectedItems.value = selectedItems.value.filter((z: ItemsDjsSingle) => {
        return z.value !== i.value
    })
}
const getGoods = async () => {
    for (let i = 0; i < selectedItems.value.length; i++) {
        await getGood(selectedItems.value[i])
        await new Promise((resolve) => setTimeout(resolve, 1000))
    }
}
const getGood = async (i: ItemsDjsSingle) => {
    await axios({
        method: 'post',
        url: reqPre + '/api',
        data: {
            reqData: [
                {
                    name: i.name,
                    formData: {
                        code: i.value + ' ' + baseForm.value.find((j: any) => j.label === '数量')?.value,
                        request_type: i.type,
                        name: baseForm.value.find((j: any) => j.label === '角色')?.value,
                        cde: 'rssls'
                    },
                    realReqUrl: 'http://kp.a5o.cn/gm/gmPay.php',
                    realReqMethod: 'post'
                }
            ]
        }
    })
}


</script>

<style scoped src="../assets/game-req.scss"></style>
<style scoped lang="scss">
:deep {
    .el-radio-button {
        margin-right: 5px;

        .el-radio-button__inner {
            box-shadow: none !important;
            border: 1px solid #dcdfe6;
            border-radius: 4px !important;
            margin-bottom: 5px;
        }
    }
}

.gameTypeWrap {
    :deep {
        .el-radio-button__inner {
            margin-bottom: 0;
        }

        .el-radio-button {
            margin-bottom: 5px;
        }
    }
}

.marginRightFive {
    margin-right: 5px;
}
</style>
