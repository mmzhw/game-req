// zip.js
import compressing from 'compressing';
import fs from 'fs';

fs.copyFileSync('./server/_.youxiang.com.crt', './dist/111.119.248.34_ca.crt');
fs.copyFileSync('./server/_.youxiang.com.crt', './dist/111.119.248.34_cer.crt');
fs.copyFileSync('./server/_.youxiang.com.key', './dist/111.119.248.34.key');

compressing.zip
    .compressDir('dist', './server/dist.zip')
    .then((res) => {
        console.log('压缩成功', res);
    })
    .catch((err) => {
        console.log(err);
    });
