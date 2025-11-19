// version.js
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的绝对路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packagePath = path.resolve(__dirname, '../package.json');
const packageObj = JSON.parse(await fs.readFile(packagePath, 'utf8'));

let verList = packageObj.version.split('.');
let currentVer = packageObj.version;

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

packageObj.version = verList.join('.');
await fs.writeFile(packagePath, JSON.stringify(packageObj, null, 4), 'utf8');
console.log(`版本由${currentVer}更新至${packageObj.version}`);
