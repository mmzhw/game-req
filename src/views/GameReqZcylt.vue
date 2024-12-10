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
import itemListing from '@/constant/zcylt'
import axios from 'axios'
import TablePagination from '@/components/Table-Pagination.vue'

const reqPre = import.meta.env.DEV ? 'http://localhost:3000' : ''

interface PropsRadioPagination {
    routeType: string
}
const props = withDefaults(defineProps<PropsRadioPagination>(), {
    routeType: 'zcylt',
})

const goodsList: any = ref(itemListing.WUPIN)
const selectedItems: any = ref([])
const keyWord: any = ref('')
const baseForm: any = ref([
    { label: '账号', value: window.localStorage.getItem(props.routeType + '账号') || 'mmzhw51' },
    { label: '数量', value: window.localStorage.getItem(props.routeType + '数量') || '1' }
])

const LSSaveValue = (type: string, value: any) => {
    window.localStorage.setItem(props.routeType + type, String(value))
}
const changeWupin = (value: string) => {
    if (value) {
        goodsList.value = itemListing.WUPIN.filter((i: ItemsSingle) => {
            return value && i.name.includes(value)
        })
    } else {
        goodsList.value = itemListing.WUPIN
    }
}
const clearSingleItem = (i: ItemsSingle) => {
    selectedItems.value = selectedItems.value.filter((z: ItemsSingle) => {
        return z.value !== i.value
    })
}
const getGoods = async () => {
    for (let i = 0; i < selectedItems.value.length; i++) {
        await getGood(selectedItems.value[i])
        await new Promise(resolve => setTimeout(resolve, 1000))
    }
}
const getGood = async (i: ItemsSingle) => {
    // let formData = new FormData()
    // formData.append('type', 'mail')
    // formData.append('checknum', '123123')
    // formData.append('uid', 'mmzhw51')
    // formData.append('item', item.value)
    // formData.append('num', '1')
    // formData.append('qu', '1')
    // let result = await axios.post('http://101.33.236.73:8081/gm/user/gmquery.php', formData, {
    //     headers: {
    //         'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    //     }
    // })

    await axios({
        method: 'post',
        url: reqPre + '/api',
        data: {
            reqData: [
                {
                    name: i.name,
                    formData: {
                        type: 'mail',
                        checknum: '123123',
                        uid: baseForm.value.find((j:any) => j.label === '账号')?.value,
                        item: i.value,
                        num: baseForm.value.find((j:any) => j.label === '数量')?.value,
                        qu: '1'
                    },
                    realReqUrl: 'http://101.33.236.73:8081/gm/user/gmquery.php',
                    realReqMethod: 'post'
                }
            ]
        }
    })
}

</script>

<style scoped src="../assets/game-req.scss"></style>
<style scoped lang="scss">
.flex-line > label {
    width: 60px;
}

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
