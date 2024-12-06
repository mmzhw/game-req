<template>
    <div class="flex-line" style="margin-bottom: 0">
        <!--        <label :style="{ width: props.labelWidth + 'px' }">版本：</label>-->
        <div style="display: flex">
            <el-button class="singleButton" @click="jumpMain">主页</el-button>
            <el-upload
                class="singleButton"
                :action="isDev ? 'http://localhost:3000/upload' : '/upload'"
                :on-success="uploadSuccess"
                :on-error="uploadError"
                accept="zip"
            >
                <el-button style="width: 100%">前端 {{ version }}</el-button>
            </el-upload>
            <el-upload
                class="singleButton"
                :action="isDev ? 'http://localhost:3000/uploadServer' : '/uploadServer'"
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
import { useRouter } from 'vue-router'

const router = useRouter()
const isDev = ref(import.meta.env.DEV)

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

const jumpMain = () => {
    router.push({ path:'/' })
}

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
}
</style>
