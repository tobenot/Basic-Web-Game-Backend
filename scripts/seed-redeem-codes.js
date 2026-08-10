// 生成兑换码批次。
// 用法: npx dotenv -e .env -- node scripts/seed-redeem-codes.js [count] [tokenAmount] [gameId] [expireDays]
// 例:   npx dotenv -e .env -- node scripts/seed-redeem-codes.js 20 5000 wenming 30
//  expireDays 省略 = 永不过期。生成的码打印到 stdout,可导入游戏运营后台。
const { PrismaClient } = require('@prisma/client');
const { randomBytes } = require('crypto');

const count = Number(process.argv[2] || 10);
const tokenAmount = Number(process.argv[3] || 5000);
const gameId = process.argv[4] || 'wenming';
const expireDays = process.argv[5] ? Number(process.argv[5]) : null;

// 8 位大写字母数字,去掉易混淆的 0/O/1/I
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function genCode() {
  const bytes = randomBytes(8);
  let s = '';
  for (let i = 0; i < 8; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

async function main() {
  const prisma = new PrismaClient();
  const rows = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      code: genCode(),
      gameId,
      tokenAmount,
      expiresAt: expireDays ? new Date(Date.now() + expireDays * 24 * 3600 * 1000) : null,
    });
  }
  // SQLite 不支持 createMany skipDuplicates,先查重再插入
  const existing = await prisma.redeemCode.findMany({ where: { code: { in: rows.map((r) => r.code) } }, select: { code: true } });
  const existingCodes = new Set(existing.map((r) => r.code));
  const fresh = rows.filter((r) => !existingCodes.has(r.code));
  if (fresh.length > 0) await prisma.redeemCode.createMany({ data: fresh });
  console.log(`✅ 生成 ${fresh.length} 个兑换码 (gameId=${gameId}, tokenAmount=${tokenAmount})`);
  for (const r of fresh) console.log(r.code);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
