let packageObj = require('../package.json')
const fs = require('fs')
let verList = packageObj.version.split('.')
if (verList[2] >= 20 && verList[1] >= 20) {
    verList[0]++
} else if (verList[2] >= 20) {
    verList[1]++
} else {
    verList[2]++
}

packageObj.version = verList.join('.')
fs.writeFileSync('package.json', JSON.stringify(packageObj, null, 4), 'utf8')
