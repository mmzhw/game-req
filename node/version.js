let packageObj = require('../package.json')
const fs = require('fs')
let verList = packageObj.version.split('.')
verList[2]++
packageObj.version = verList.join('.')
fs.writeFileSync('package.json', JSON.stringify(packageObj, null, 4), 'utf8')
