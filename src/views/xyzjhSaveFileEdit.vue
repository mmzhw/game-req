<script setup lang="ts">
import { onMounted, ref } from 'vue'
import axios from 'axios'

const itemObj = ref({})

const handleFileSelect = (event) => {
    const target = event.target
    const files = target.files

    if (files && files.length > 0) {
        const reader = new FileReader()
        reader.onload = (e) => {
            try {
                const content = e.target?.result
                const json = JSON.parse(content)

                itemObj.value = json.playerentity['1'].itemStorage.content

                console.log(itemObj.value)
            } catch (error) {
                console.log(error)
            }
        }
        reader.onerror = () => {}
        reader.readAsText(files[0])
    }
}

const handleChange = (key) => {
    console.log(itemObj.value[key])
}

const itemOptions = ref([])
onMounted(async () => {
    let response = await axios.get('db1_parsed.json')
    itemOptions.value = response.data || []
})
</script>

<template>
    <div class="container">
        <input style="padding-bottom: 10px" type="file" accept=".json" @change="handleFileSelect" />
        <div class="item-wrap" v-for="key in Object.keys(itemObj)" :key="key">
            <div>{{ key }}：</div>
            <template v-for="subkey in Object.keys(itemObj[key])" :key="key + subkey">
                <div>{{ subkey }}</div>
                <el-select-v2 v-if="subkey === '1'" v-model="itemObj[key][subkey]" :options="itemOptions" class="item-edit" @change="handleChange(key)" />
                <el-switch v-else-if="typeof itemObj[key][subkey] === 'boolean'" v-model="itemObj[key][subkey]" @change="handleChange(key)" />
                <el-input-number v-else-if="!isNaN(Number(itemObj[key][subkey]))" v-model="itemObj[key][subkey]" class="item-edit" @change="handleChange(key)" />
                <el-input v-else v-model="itemObj[key][subkey]" class="item-edit" @change="handleChange(key)" />
            </template>
        </div>
    </div>
</template>

<style scoped>
.container {
    padding: 20px;
}
.item-wrap {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-bottom: 10px;
}
.item-edit {
    width: 200px;
}
</style>
