<template>
    <div class="wrap">
        <div class="flow-wrap">
            <p>1、获取存档文件：SaveObjectDynamicData.save</p>
            <p>2、访问<a href="https://es3.tusinean.ro" target="_blank">https://es3.tusinean.ro</a>，输入密码<el-button type="text" @click="copy('Meow')">Meow</el-button>，Decryption下上传存档文件后下载解密后的文件</p>
            <p>3、将解密后的文件在本网站上传后编辑后保存</p>
            <p>4、将保存后的文件访问<a href="https://es3.tusinean.ro" target="_blank">https://es3.tusinean.ro</a>后在Encryption下上传，并勾选GZip后将加密后的文件下载下来</p>
            <p>5、将加密后的文件名称改为SaveObjectDynamicData.save放到游戏原位置即可</p>
        </div>
       <el-upload class="upload-demo" drag action="#" :on-change="handleFileChange" :auto-upload="false" :show-file-list="false">
            <el-icon class="el-icon--upload">
                <upload-filled />
            </el-icon>
            <div class="el-upload__text">Drop file here or <em>click to upload</em></div>
        </el-upload>
        <el-button type="primary" @click="save">保存</el-button>
        <p v-if="itemList.length" class="warn-text">TIP：不知道如何修改的，多合一些功法抄就行了</p>
        <div class="list-wrap" v-for="(item, index) in itemList" :key="index">
            <div class="item">
                <div class="label">武功ID:</div>
                <div class="value">{{ item.UName }}</div>
            </div>
            <div class="item">
                <div class="label">武功名称:</div>
                <div class="value">{{ item.SChinese }}</div>
            </div>
            <div class="item">
                <div class="label">武功性质:</div>
                <div class="value">
                    <el-input v-model="item.InterForceType" />
                    <p class="warn-text">0：调和；1：阳性；2：阴性</p>
                </div>
            </div>
            <div class="item" v-if="item.ActiveInternalBuffs?.length">
                <div class="label">内功BUFF:</div>
                <div class="value">
                    <el-select class="select-wrap" v-model="item.ActiveInternalBuffs" :collapse-tags="false" :clearable="false" multiple filterable allow-create default-first-option>
                        <el-option v-for="(neigong, jIndex) in neigongList" :key="'neigong' + jIndex" :label="neigong" :value="neigong" />
                    </el-select>
                    <p class="warn-text">注意：BUFF可选项从其他地方抄的，不一定完全准确，如果不对可以自行输入后回车，可以自己合了之后来查看描述再抄过来</p>
                </div>
            </div>
            <div class="item" v-if="item.CastBuffs?.length">
                <div class="label">武功BUFF:</div>
                <div class="value">
                    <el-select class="select-wrap" v-model="item.CastBuffs" :collapse-tags="false" :clearable="false" multiple filterable allow-create default-first-option>
                        <el-option v-for="(wugong, jIndex) in []" :key="'wugong' + jIndex" :label="wugong" :value="wugong" />
                    </el-select>
                    <p class="warn-text">注意：自行输入后回车，可以自己合了之后来查看描述再抄过来</p>
                </div>
            </div>
            <div class="item">
                <div class="label">十级属性:</div>
                <div class="value">
                    <div class="small-item" v-for="(_, zIndex) in item.CharacterPropAdd" :key="'small' + zIndex">
                        <p>{{ zIndex + 1 }}</p>
                        <el-input v-model="item.CharacterPropAdd[zIndex]" />
                        <el-button style="margin-left: 5px" :icon="Close" @click="item.CharacterPropAdd.splice(zIndex, 1)"></el-button>
                    </div>
                    <el-button :icon="Plus" @click="item.CharacterPropAdd.push('')"></el-button>
                </div>
            </div>
            <div class="item">
                <div class="label">施展条件:</div>
                <div class="value">
                    <div class="small-item" v-for="(_, zIndex) in item.CharacterPropNeed" :key="'small1' + zIndex">
                        <p>{{ zIndex + 1 }}</p>
                        <el-input v-model="item.CharacterPropNeed[zIndex]" />
                        <el-button style="margin-left: 5px" :icon="Close" @click="item.CharacterPropNeed.splice(zIndex, 1)"></el-button>
                    </div>
                    <el-button :icon="Plus" @click="item.CharacterPropNeed.push('')"></el-button>
                </div>
            </div>
        </div>
    </div>
</template>
<script setup>
import { Close, Plus, UploadFilled } from '@element-plus/icons-vue'
import { ref } from 'vue'
import _ from 'lodash'
import moment from 'moment'

const itemList = ref([])
const neigongList = ref(['内功_九州诀', '内功_紫薇龙气', '内功_天魔噬魂术', '内功_无极混元功', '内功_摩诃无量', '内功_梵天圣功', '内功_天女散花', '内功_巫蛊毒功', '内功_霓裳羽衣经', '内功_一刀流', '内功_无锋剑意', '内功_通天伏魔功', '内功_兽王诀', '内功_祈禳大法', '内功_儒十三经', '内功_九霄真经', '内功_惊涛骇浪诀', '内功_大日如来经', '内功_满江红', '内功_圣火神功', '内功_无极洞心法', '内功_黄帝阴符经', '内功_烈阳焚天诀', '内功_九幽寒霜气', '内功_吠陀宝经', '内功_霸刀诀', '内功_尉缭子', '内功_绝毒残篇', '内功_DLC2长恨歌', '内功_DLC2九星连珠', '内功_DLC2乖离无相功', '内功_DLC2罗刹决'])

let origin = ''

const handleFileChange = (file) => {
    const reader = new FileReader()
    reader.onload = () => {
        operationFile(reader.result)
    }
    reader.readAsText(file.raw)
}
const copy = (text) => {
    navigator.clipboard.writeText(text)
        .then(() => {
            console.log('复制成功');
        })
        .catch(err => {
            // 备用方案：创建临时textarea
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            console.log('已复制（备用方法）');
        });
}

const operationFile = (fileStr) => {
    origin = fileStr
    let obj = JSON.parse(fileStr)
    let list = obj.Data.value.storedDatas
    console.log('数据',list)
    let filteredList = list.filter((i) => i.SChinese).filter((i) => i.UName.match('ItemName_'))
    filteredList = filteredList.map((i) => {
        let item = { UName: i.UName, SChinese: i.SChinese, matchName: i.UName.replace('ItemName_', '') }
        list.forEach((j) => {
            if (j['__type'] === 'GameData.KungfuData,ModShare.Runtime' && j.UName.match(item.matchName)) {
                item.InterForceType = j.InterForceType //
                item.ActiveInternalBuffs = j.ActiveInternalBuffs //内功
                item.CastBuffs = j.CastBuffs //武功
                item.CharacterPropNeed = j.CharacterPropNeed.map((i) => JSON.stringify(i))
            }
            if (j['__type'] === 'GameData.KungfuLevelData,ModShare.Runtime' && j.UName.match(item.matchName + '_10')) {
                item.CharacterPropAdd = j.CharacterPropAdd.map((i) => JSON.stringify(i))
            }
        })
        return item
    })
    itemList.value = filteredList
}

const save = () => {
    try {
        let list = _.cloneDeep(itemList.value)
        let originObj = JSON.parse(origin)
        list.forEach((i) => {
            originObj.Data.value.storedDatas.forEach((j) => {
                if (j['__type'] === 'GameData.KungfuData,ModShare.Runtime' && j.UName.match(i.matchName)) {
                    j.InterForceType = i.InterForceType
                    j.ActiveInternalBuffs = i.ActiveInternalBuffs
                    j.CastBuffs = i.CastBuffs
                    j.CharacterPropNeed = i.CharacterPropNeed.map((m) => JSON.parse(m))
                }
                if (j['__type'] === 'GameData.KungfuLevelData,ModShare.Runtime' && j.UName.match(i.matchName + '_10')) {
                    j.CharacterPropAdd = i.CharacterPropAdd.map((m) => JSON.parse(m))
                }
            })
        })
        savefile(originObj)
    } catch (e) {
        alert('请检查是否有错误的格式')
        console.log(e?.message || e)
    }
}
const savefile = (jsonObject) => {
    try {
        // 将 JSON 对象转换为字符串
        const jsonString = JSON.stringify(jsonObject)

        // 创建一个 Blob 对象
        const blob = new Blob([jsonString], { type: 'text/plain;charset=utf-8' })

        // 创建下载链接
        const downloadLink = document.createElement('a')
        downloadLink.href = URL.createObjectURL(blob)
        downloadLink.download = `SaveFile_${moment().unix()}.decrypted`

        // 添加到 DOM 并触发点击
        document.body.appendChild(downloadLink)
        downloadLink.click()

        // 清理
        document.body.removeChild(downloadLink)
        URL.revokeObjectURL(downloadLink.href)

        console.log('JSON 已编码并下载')
        return true
    } catch (error) {
        console.error('下载编码后的 JSON 时出错:', error)
        return false
    }
}
</script>

<style scoped>
.wrap {
    padding-bottom: 10px;
}
div {
    box-sizing: border-box;
}

.upload-demo {
    margin-bottom: 10px;
}

.list-wrap {
    width: 100%;
    border: 1px dashed #ccc;
    padding: 10px;
    margin-bottom: 10px;

    .item {
        display: flex;
        line-height: 32px;
        padding-bottom: 10px;

        .label {
            width: 80px;
        }

        .value {
            flex: 1;
        }

        .select-wrap {
            width: 100%;
        }
    }
}

.small-item {
    display: flex;
    padding-bottom: 5px;

    p {
        padding-right: 10px;
    }
}

.warn-text {
    color: red;
    font-size: 12px;
}
.flow-wrap{
    padding-bottom: 10px;
}
</style>
