// version.js
// 版本管理脚本，用于自动更新package.json中的版本号
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的绝对路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定义package.json文件路径并读取其内容
const packagePath = path.resolve(__dirname, '../package.json');
const packageObj = JSON.parse(await fs.readFile(packagePath, 'utf8'));

// 获取当前版本号并按.分割为数组
let verList = packageObj.version.split('.');
let currentVer = packageObj.version;

// 根据当前版本号计算新版本号
// 如果补丁版本号大于等于20且小版本号也大于等于20，则主版本号加1，小版本号和补丁版本号归零
// 如果只有补丁版本号大于等于20，则小版本号加1，补丁版本号归零
// 否则补丁版本号加1
if (parseInt(verList[2]) >= 20 && parseInt(verList[1]) >= 20) {
    verList[0]++;
    verList[1] = 0;
    verList[2] = 0;
} else if (parseInt(verList[2]) >= 20) {
    verList[1]++;
    verList[2] = 0;
} else {
    verList[2]++;
}

// 更新package.json中的版本号并写入文件
packageObj.version = verList.join('.');
await fs.writeFile(packagePath, JSON.stringify(packageObj, null, 4), 'utf8');
console.log(`版本由${currentVer}更新至${packageObj.version}`);