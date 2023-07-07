let packageObj = require("../package.json");
const fs = require("fs");
let verList = packageObj.version.split(".");
let currentVer = packageObj.version;
if (verList[2] >= 20 && verList[1] >= 20) {
    verList[0]++;
    verList[1] = 0;
    verList[2] = 0;
} else if (verList[2] >= 20) {
    verList[1]++;
    verList[2] = 0;
} else {
    verList[2]++;
}

packageObj.version = verList.join(".");
fs.writeFileSync("package.json", JSON.stringify(packageObj, null, 4), "utf8");
console.log(`版本由${currentVer}更新至${packageObj.version}`);
