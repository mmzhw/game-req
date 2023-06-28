<template>
    <div class="flex-column paddingTen">
        <div class="flex-line marginBottomFive">
            <label>游戏选择：</label>
            <div class="gameTypeWrap">
                <el-radio-group v-model="routeType" @change="changeRouteType">
                    <el-radio-button label="glqxz">古龙群侠传</el-radio-button>
                    <el-radio-button label="gjqt">古剑奇谭</el-radio-button>
                </el-radio-group>
            </div>
        </div>
        <div class="flex-column" v-show="hasPage">
            <div class="flex-line">
                <label>发送姓名：</label>
                <div>
                    <el-input v-model="nameWord" @input="changeName" />
                </div>
            </div>
            <div class="flex-line">
                <label>发送类型：</label>
                <div>
                    <el-select
                        style="width: 100%"
                        v-model="reqType"
                        placeholder="Select"
                        @change="changeReqType"
                    >
                        <el-option label="充值一" value="charge" />
                        <el-option label="充值二" value="charge2" />
                        <el-option label="邮件" value="mail" />
                    </el-select>
                </div>
            </div>
            <div class="flex-line">
                <label>发送数目：</label>
                <div>
                    <el-input v-model="itemNum" placeholder="数目" @change="changeItemNumber" />
                </div>
            </div>
            <div class="flex-line" v-if="reqType === 'mail'">
                <label>过滤物品：</label>
                <div>
                    <el-input v-model="keyWord" placeholder="过滤" @input="changeWupin" />
                </div>
            </div>
            <el-radio-group
                class="marginBottomFive"
                :class="isMobile && 'mobileRadio'"
                v-model="choosedItem"
                @change="changeItemId"
            >
                <el-radio-button
                    v-for="(item, index) in realItemsList"
                    :key="index"
                    :label="item.value"
                >{{ item.name }}
                </el-radio-button>
            </el-radio-group>
            <el-pagination
                class="marginBottomTen"
                background
                :layout="pageObj.layout"
                :page-sizes="pageObj.sizes"
                :total="itemsList?.length"
                :page-size="pageObj.size"
                :current-page="pageObj.current"
                @current-change="pageCurrentChange"
                @size-change="pageSizeChange"
            />
            <el-button class="marginBottomTen" style="width: 100%" type="primary" @click="reqFun">发送</el-button>
            <control-server
                @uploadSuccess="uploadSuccess"
                @uploadError="uploadError"
                label-width="85"
            ></control-server>
            <el-divider />
            <p v-for="(log, index) in logList" :key="'log' + index">{{ log }}</p>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted } from 'vue';
import defaultValues from '@/constant/DEFAULT_VALUES';
import axios from 'axios';
import ControlServer from '../components/Control-Server.vue';
import { useRoute, useRouter } from 'vue-router';

let routerParams = useRoute().params;
const router = useRouter();
const routeType = ref(routerParams?.id || '');
const nameWord = ref('');
const itemNum = ref('');
const choosedItem = ref('');
const reqType = ref('');
const keyWord = ref('');
const isMobile = ref(/mobile/i.test(navigator.userAgent));
const pageObj: any = ref({
    size: 10,
    sizes: [10, 20, 50, 100, 1000, 5000],
    current: 1,
    layout: ''
});
let itemsList: any = ref([]);
let logList: any = ref([]);

let hasPage = computed({
    get() {
        return !!defaultValues[routeType.value as string];
    },
    set() {
    }
});
let realItemsList = computed(() => {
    return itemsList.value.slice(
        pageObj.value.size * (pageObj.value.current - 1),
        pageObj.value.size * pageObj.value.current
    );
});

onMounted(() => {
    if (isMobile.value) {
        pageObj.value.layout = 'prev, next, sizes, total';
    } else {
        pageObj.value.layout = 'prev, pager, next, sizes, total';
    }
    initPage('');
});

//切换页面
const changeRouteType = (value: string) => {
    router.push({ name: 'manage', params: { id: value } });
    initPage(value);
};

//切换物品id
const changeItemId = (item: number) => {
    window.localStorage.setItem(routeType.value + 'itemId', String(item));
};
//切换充值类型
const changeReqType = (type: string) => {
    if (type) {
        reqType.value = type;
        itemsList.value = defaultValues[routeType.value as string][type];
        window.localStorage.setItem(routeType.value + 'reqType', type);
    }
};
//修改发送数目
const changeItemNumber = (value: string) => {
    window.localStorage.setItem(routeType.value + 'itemNumber', value);
};
//过滤物品
const changeWupin = (value: string) => {
    window.localStorage.setItem(routeType.value + 'filterName', value);
    if (value) {
        itemsList.value = defaultValues[routeType.value as string]?.mail.filter(
            (i: ItemsSingle) => {
                return value && i.name.includes(value);
            }
        );
    } else {
        itemsList.value = defaultValues[routeType.value as string]?.mail;
    }
};
const changeName = (value: string) => {
    window.localStorage.setItem(routeType.value + 'nameWord', value);
};
//翻页
const pageCurrentChange = (size: number) => {
    pageObj.value.current = size;
};
//分页数目切换
const pageSizeChange = (sizes: number) => {
    pageObj.value.size = sizes;
    pageObj.value.current = 1;
};

const reqFun = async () => {
    let result = await axios({
        method: 'post',
        url: '/api',
        data: {
            formData: defaultValues[routeType.value as string]?.getReqFormData(
                reqType.value,
                nameWord.value,
                itemNum.value,
                choosedItem.value
            ),
            params: defaultValues[routeType.value as string]?.getReqParams(
                reqType.value,
                nameWord.value,
                itemNum.value,
                choosedItem.value
            ),
            realReqUrl: defaultValues[routeType.value as string]?.realReqUrl,
            realReqMethod: defaultValues[routeType.value as string]?.realReqMethod
        }
    });
    logList.value.push(result?.data);
};

const uploadSuccess = (response: any) => {
    logList.value.push(response);
};
const uploadError = (response: any) => {
    logList.value.push(response);
};

const initPage = (id: string) => {
    if (id) {
        routeType.value = id;
    }
    if (routeType.value && defaultValues[routeType.value as string]){
        nameWord.value = defaultValues[routeType.value as string]?.nameWord;
        itemNum.value = defaultValues[routeType.value as string]?.itemNum;
        choosedItem.value = defaultValues[routeType.value as string]?.itemId;
        keyWord.value = defaultValues[routeType.value as string]?.filterName;
        changeReqType(defaultValues[routeType.value as string]?.reqType);
        changeWupin(keyWord.value);
    }
};
</script>

<style scoped src="../assets/game-req.scss"></style>
<style scoped lang="scss">
.flex-line > label {
    width: 85px;
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

.mobileRadio {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;

    :deep {
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

.gameTypeWrap{
    :deep {
        .el-radio-button__inner {
            margin-bottom: 0;
        }
    }
}
</style>
