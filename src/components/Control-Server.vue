<template>
    <div class="flex-line" style="margin-bottom: 0">
        <label>版本控制：</label>
        <div style="display: flex">
            <el-upload
                class="singleButton"
                action="/upload"
                :on-success="uploadSuccess"
                :on-error="uploadError"
                accept="zip"
            >
                <el-button style="width: 100%">前端 {{ version }}</el-button>
            </el-upload>
            <el-upload
                class="singleButton"
                action="/uploadServer"
                :on-success="uploadSuccess"
                :on-error="uploadError"
                accept="js"
            >
                <el-button style="width: 100%">服务端</el-button>
            </el-upload>
        </div>
        <!--                <el-button class="singleButton" @click="reStartServer">重启服务</el-button>-->
    </div>
</template>

<script lang="ts" setup>
import { ref } from 'vue'
// import axios from "axios";

const props = defineProps<{
    labelWidth: String
}>()
const emit = defineEmits<{
    //分别抛出是两个函数
    (e: 'uploadSuccess', value: any): any
    (e: 'uploadError', value: any): any
}>()

// @ts-ignore
const version = ref(__Admin_VERSION__ as string)

const uploadSuccess = (response: any) => {
    emit('uploadSuccess', response)
}
const uploadError = (response: any) => {
    emit('uploadError', response)
}
// const reStartServer = () => {
//     axios({ method: "post", url: "/restart" });
// };
</script>
<style scoped src="../assets/game-req.scss"></style>
<style scoped lang="scss">
.singleButton {
    margin-right: 10px;
    //width: calc((100% - 10px) / 2);
    :deep{
        .el-upload{
            //width: 100%;
        }
    }
}
</style>
