import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 读取 db1.txt 文件并提取 item_base|7387 和 shop|15820 之间的内容
 * 提取物品id和物品名称，输出为 JSON 格式
 */
function parseDb1File() {
    const filePath = path.join(__dirname, 'db1.txt');
    
    // 读取文件内容
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    let startIndex = -1;
    let endIndex = -1;
    
    // 找到 item_base|7387 和 shop|15820 的位置
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() === 'item_base|7387') {
            startIndex = i + 1; // 从下一行开始
        }
        if (lines[i].trim() === 'shop|15820') {
            endIndex = i;
            break;
        }
    }
    
    if (startIndex === -1) {
        console.error('错误：未找到 item_base|7387 标记');
        return [];
    }
    
    if (endIndex === -1) {
        console.error('错误：未找到 shop|15820 标记');
        return [];
    }
    
    console.log(`起始行：${startIndex}, 结束行：${endIndex}`);
    console.log(`总行数：${endIndex - startIndex}`);
    
    // 提取范围内的所有行
    const targetLines = lines.slice(startIndex, endIndex);
    
    // 解析每一行，提取物品 ID 和名称
    const items = [];
    for (const line of targetLines) {
        const trimmedLine = line.trim();
        if (trimmedLine) {
            // 使用 # 分割，第一个是 ID，第二个是名称
            const parts = trimmedLine.split('#');
            if (parts.length >= 2) {
                const itemId = parts[0];
                const itemName = parts[1];
                
                // 只处理以数字开头的行（配方数据）
                if (/^\d+$/.test(itemId)) {
                    items.push({
                        value: parseInt(itemId),
                        label: `${itemName}(${itemId})`
                    });
                }
            }
        }
    }
    
    return items;
}

// 执行解析并保存结果
const items = parseDb1File();

console.log(`\n成功解析 ${items.length} 个物品`);
console.log('前 10 个物品示例:');
console.log(JSON.stringify(items.slice(0, 10), null, 2));

// 保存为 JSON 文件到 public 目录
const outputPath = path.join(__dirname, '..', 'public', 'db1_parsed.json');
fs.writeFileSync(outputPath, JSON.stringify(items, null, 2), 'utf-8');
console.log(`\n已保存到文件：${outputPath}`);
