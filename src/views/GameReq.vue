<template>
    <div class="wrap">
        <div class="flex-line" style="margin-bottom: 0">
            <label>游戏选择：</label>
            <div>
                <el-radio-group v-model="routeType" @change="changeRouteType">
                    <el-radio-button label="glqxz">古龙群侠传</el-radio-button>
                    <el-radio-button label="gjqt">古剑奇谭</el-radio-button>
                </el-radio-group>
            </div>
        </div>
        <div class="wrap" v-show="hasPage">
            <div class="flex-line">
                <label>发送姓名：</label>
                <div>
                    <el-input v-model="nameWord" @input="changeName" />
                </div>
            </div>
            <div class="flex-line">
                <label>发送类型：</label>
                <div>
                    <el-select v-model="reqType" placeholder="Select" @change="changeReqType">
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
            <div class="flex-line" v-if="reqType === 'mail'">
                <label>展示方式：</label>
                <div>
                    <el-radio-group v-model="pageType" @change="changeList">
                        <el-radio-button :label="2">分页</el-radio-button>
                        <el-radio-button :label="1">全部</el-radio-button>
                    </el-radio-group>
                </div>
            </div>
            <div class="flex-line">
                <label>物品展示：</label>
                <div ref="pageDiv">
                    <template v-if="radioList?.length > 0">
                        <el-radio-group v-model="radio" @change="changeItemId">
                            <el-radio
                                v-for="(item, index) in radioList"
                                :key="index"
                                :label="item.value"
                            >{{ item.name }}
                            </el-radio>
                        </el-radio-group>
                        <el-pagination
                            class="marginTopFive"
                            v-if="reqType === 'mail' && pageType === 2"
                            background
                            hide-on-single-page
                            small
                            layout="prev, pager, next"
                            :total="listLength"
                            :page-size="pageSize"
                            :pager-count="pagerCount"
                            @current-change="pageChange"
                            @size-change="sieChange"
                        />
                    </template>
                    <p v-else>无数据</p>
                </div>
            </div>
            <div class="flex-line">
                <label>执行：</label>
                <div style="display: flex">
                    <el-button style="margin-right: 10px" type="primary" @click="reqFun"
                    >发送
                    </el-button>
                </div>
            </div>
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
import { ref, computed, onMounted } from "vue";
import defaultValues from "@/constant/DEFAULT_VALUES";
import axios from "axios";
import ControlServer from "../components/Control-Server.vue";
import { useRoute, useRouter } from "vue-router";
// import qs from 'qs'

let routerParams = useRoute().params;

const routeType = ref(routerParams?.id || "");
const nameWord = ref("");
const itemNum = ref("");
const radio = ref("");
const reqType = ref("");
const listLength = ref(0);
const keyWord = ref("");
const pageType = ref(2);
const pageSize = ref(10);
const pagerCount = ref(5);
let radioList: any = ref([]);
let logList: any = ref([]);
const pageDiv = ref<HTMLElement>();

const router = useRouter();

let hasPage = computed({
    get() {
        return !!defaultValues[routeType.value as string];
    },
    set() {
    }
});

//切换页面
const changeRouteType = (value: string) => {
    router.push({ name: "manage", params: { id: value } });
    initPage(value);
};

//切换全部/分页
const changeList = (value: number) => {
    if (value === 1) {
        radioList.value = defaultValues[routeType.value as string]?.mail;
    } else {
        keyWord.value = "";
        radioList.value = defaultValues[routeType.value as string]?.mail.slice(0, 10);
    }
};
//切换物品id
const changeItemId = (item: number) => {
    window.localStorage.setItem(routeType.value + "itemId", String(item));
};
//切换充值类型
const changeReqType = (type: string) => {
    if (type) {
        reqType.value = type;
        radioList.value = defaultValues[routeType.value as string][type];
        if (type === "mail") {
            changeList(2);
        }
        window.localStorage.setItem(routeType.value + "reqType", type);
    }
};
//修改发送数目
const changeItemNumber = (value: string) => {
    window.localStorage.setItem(routeType.value + "itemNumber", value);
};
//过滤物品
const changeWupin = (value: string) => {
    if (value) {
        pageType.value = 1;
        radioList.value = defaultValues[routeType.value as string]?.mail.filter((i: ItemsSingle) => {
            return value && i.name.includes(value);
        });
        listLength.value = radioList.value.length;
    }
};
const changeName = (value: string) => {
    window.localStorage.setItem(routeType.value + "nameWord", value);
};
//翻页
const pageChange = (size: number) => {
    radioList.value = defaultValues[routeType.value as string]?.mail.slice(
        (size - 1) * pageSize.value,
        pageSize.value * size
    );
};
//分页数目切换
const sieChange = (sizes: number) => {
    pageSize.value = sizes;
    pageChange(1);
};

const reqFun = async () => {
    let result = await axios({
        method: "post",
        url: "/api",
        data: {
            formData: defaultValues[routeType.value as string]?.getReqFormData(
                reqType.value,
                nameWord.value,
                itemNum.value,
                radio.value
            ),
            params: defaultValues[routeType.value as string]?.getReqParams(
                reqType.value,
                nameWord.value,
                itemNum.value,
                radio.value
            ),
            realReqUrl: defaultValues[routeType.value as string]?.realReqUrl,
            realReqMethod: defaultValues[routeType.value as string]?.realReqMethod
        }
        // url: 'http://106.74.21.2:81/jkgm/user/playerapi.php',
        // data: qs.stringify(getParams()),
        // params: {act: 'send', sid: 1001}
    });
    logList.value.push(result?.data);
};

const uploadSuccess = (response: any) => {
    logList.value.push(response);
};
const uploadError = (response: any) => {
    logList.value.push(response);
};

onMounted(() => {
    initPage("");
    if (pageDiv.value) {
        pagerCount.value = Math.floor(pageDiv!.value!.offsetWidth / 3 / 24);
        window.onresize = () => {
            pagerCount.value = Math.floor(pageDiv!.value!.offsetWidth / 3 / 24);
        };
    }
});
const initPage = (id: string) => {
    if (id) {
        routeType.value = id;
    }
    nameWord.value = defaultValues[routeType.value as string]?.nameWord;
    itemNum.value = defaultValues[routeType.value as string]?.itemNum;
    radio.value = defaultValues[routeType.value as string]?.itemId;
    reqType.value = defaultValues[routeType.value as string]?.reqType;
    listLength.value = defaultValues[routeType.value as string]?.mail.length;
    changeReqType(reqType.value);
};
</script>

<style scoped src="../assets/game-req.scss"></style>
<style scoped lang="scss">
.flex-line > label {
    width: 85px;
}
</style>
