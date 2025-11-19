const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const inputFilePath = path.join(__dirname, 'SaveObjectDynamicData.save');
const outputFilePath = path.join(__dirname, 'SaveObjectDynamicData.json');

fs.readFile(inputFilePath, (readErr, compressedData) => {
    if (readErr) {
        console.error('读取文件失败:', readErr);
        return;
    }

    zlib.gunzip(compressedData, (unzipErr, decompressedData) => {
        if (unzipErr) {
            console.error('解压失败:', unzipErr);
            return;
        }

        fs.writeFile(outputFilePath, decompressedData, (writeErr) => {
            if (writeErr) {
                console.error('写入文件失败:', writeErr);
                return;
            }
            console.log('文件解压成功并保存至:', outputFilePath);
        });
    });
});