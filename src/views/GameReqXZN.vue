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
import itemListing from '@/constant/xzn'
import axios from 'axios'

const reqPre = import.meta.env.DEV ? 'http://localhost:3000' : ''

interface PropsRadioPagination {
    routeType: string
}
const props = withDefaults(defineProps<PropsRadioPagination>(), {
    routeType: 'xzn',
})

const goodsList: any = ref(itemListing.WUPIN)
const selectedItems: any = ref([])
const keyWord: any = ref('')
const baseForm: any = ref([
    { label: '角色id', value: window.localStorage.getItem(props.routeType + '角色id') || 'ns00000008' },
    { label: '数量', value: window.localStorage.getItem(props.routeType + '数量') || '1' }
])

const LSSaveValue = (type: string, value: any) => {
    window.localStorage.setItem(props.routeType + type, String(value))
}
const changeWupin = (value: string) => {
    if (value) {
        goodsList.value = itemListing.WUPIN.filter((i: ItemsDjsSingle) => {
            return value && i.name.includes(value)
        })
    } else {
        goodsList.value = itemListing.WUPIN
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
        await new Promise(resolve => setTimeout(resolve, 1000))
    }
}
const getGood = async (i: ItemsDjsSingle) => {
    // let formData = new FormData()
    // formData.append('title', 'GM')
    // formData.append('text', 'GM')
    // formData.append('server_select', '1')
    // formData.append('accname', baseForm.value.find((j:any) => j.label === '角色id')?.value)
    // formData.append('reward1_1', i.type)
    // formData.append('reward1_2', i.value)
    // formData.append('reward1_3', baseForm.value.find((j:any) => j.label === '数量')?.value)
    // formData.append('reward2_1', '0')
    // formData.append('reward2_3', '')
    // formData.append('reward3_1', '0')
    // formData.append('reward3_3', '')
    //
    // let result = await axios.post('http://111.119.248.34:82/manage/mail_one/', formData, {
    //     headers: {
    //         'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    //     }
    // })
    //
    // console.log(result)



    await axios({
        method: 'post',
        url: reqPre + '/api',
        data: {
            reqData: [
                {
                    name: i.name,
                    formData: {
                        title: 'GM',
                        text: 'GM',
                        server_select: '1',
                        accname: baseForm.value.find((j:any) => j.label === '角色id')?.value,
                        reward1_1: i.type,
                        reward1_2: i.value,
                        reward1_3: baseForm.value.find((j:any) => j.label === '数量')?.value,
                        reward2_1:'0',
                        reward2_3:'',
                        reward3_1:'0',
                        reward3_3:'',
                    },
                    realReqUrl: 'http://111.119.248.34:82/manage/mail_one/',
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
