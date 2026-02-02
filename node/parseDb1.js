import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 读取db1.txt文件
const filePath = join(__dirname, '../public/db1.txt');
const content = fs.readFileSync(filePath, 'utf-8');

// 按行分割内容
const lines = content.trim().split('\n');

// 解析每一行并转换为对象数组
const result = lines.map(line => {
  // 跳过空行或不符合格式的行
  if (!line || !line.includes('#')) {
    return null;
  }

  // 分割每行内容
  const parts = line.split('#');
  const value = Number(parts[0]) // #前面的部分
  // const value = parts[0] // #前面的部分
  const label = parts.slice(1).join('#') + '(' + value + ')' // #后面的部分（处理可能包含#号的label）

  return { value, label };
}).filter(item => item !== null); // 过滤掉空行或无效行

// 输出结果
console.log(JSON.stringify(result, null, 2));

// 将结果保存到文件
const outputPath = join(__dirname, '../public/db1_parsed.json');
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log(`\n解析完成！结果已保存到 ${outputPath}`);
console.log(`共解析了 ${result.length} 条记录`);
