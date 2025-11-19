// zip.js
// 压缩脚本，用于将dist目录打包成zip文件
import compressing from 'compressing';
import fs from 'fs';

// 将dist目录下的文件复制到指定位置（注释掉的代码）
// fs.copyFileSync('./server/_.youxiang.com.crt', './dist/111.119.248.34_ca.crt');
// fs.copyFileSync('./server/_.youxiang.com.crt', './dist/111.119.248.34_cer.crt');
// fs.copyFileSync('./server/_.youxiang.com.key', './dist/111.119.248.34.key');

fs.copyFileSync('./server/server.js', './dist/server.js');
fs.copyFileSync('./server/watch.js', './dist/watch.js');

// 使用compressing库将dist目录压缩为server/dist.zip文件
compressing.zip
    .compressDir('dist', './server/dist.zip')
    .then((res) => {
        console.log('压缩成功', res);
    })
    .catch((err) => {
        console.log(err);
    });
