const compressing = require('compressing')
const fs = require('fs')

fs.copyFileSync('./server/_.youxiang.com.crt', './dist/_.youxiang.com.crt');
fs.copyFileSync('./server/_.youxiang.com.key', './dist/_.youxiang.com.key');

compressing.zip
    .compressDir('dist', './server/dist.zip')
    .then((res) => {
        console.log(res)
    })
    .catch((err) => {
        console.log(err)
    })
