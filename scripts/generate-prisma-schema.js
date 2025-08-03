const fs = require('fs');
const path = require('path');

// 确保在运行此脚本之前已经加载了 .env 文件
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('错误：DATABASE_URL 环境变量未设置。');
  console.error('请确保您的 .env 文件中已定义 DATABASE_URL，并在运行脚本时加载它。');
  console.error('例如: npx dotenv -e .env -- node scripts/generate-prisma-schema.js');
  process.exit(1);
}

// 根据 DATABASE_URL 的前缀判断数据库提供者
const provider = databaseUrl.startsWith('file:') ? 'sqlite' : 'postgresql';

// 定义模板和目标文件的路径
const templatePath = path.join(__dirname, '..', 'prisma', 'schema.prisma.template');
const prismaSchemaPath = path.join(__dirname, '..', 'prisma', 'schema.prisma');

// 读取模板文件内容
let schemaContent;
try {
  schemaContent = fs.readFileSync(templatePath, 'utf8');
} catch (error) {
  console.error(`错误：无法读取模板文件 ${templatePath}`);
  console.error(error);
  process.exit(1);
}

// 替换占位符
const finalSchema = schemaContent.replace('%%PROVIDER%%', provider);

// 写入新的 schema.prisma 文件内容
fs.writeFileSync(prismaSchemaPath, finalSchema, 'utf8');

console.log(`✅ Prisma schema 已为 provider "${provider}" 生成。`);
console.log(`✅ 文件已保存至: ${prismaSchemaPath}`);
