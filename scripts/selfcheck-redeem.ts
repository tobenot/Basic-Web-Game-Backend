// 兑换码幂等自检(需 DB)。运行: npm run selfcheck:redeem
// 会用随机码 + 随机会话写库,跑完清理现场。DB 指向 DATABASE_URL。
import { randomBytes } from 'crypto';
import assert from 'assert';
import { claimRedeemCode } from '../src/ai/redeem';
import { prisma } from '../src/db';

async function main() {
  const gameId = 'wenming';
  const code = `SELFCHECK-${randomBytes(4).toString('hex').toUpperCase()}`;
  const sessionA = `selfcheck-a-${randomBytes(4).toString('hex')}`;
  const sessionB = `selfcheck-b-${randomBytes(4).toString('hex')}`;

  await prisma.redeemCode.create({ data: { code, gameId, tokenAmount: 1000 } });

  try {
    const first = await claimRedeemCode(code, sessionA, gameId);
    assert.strictEqual(first.addedTokens, 1000, '首次兑换应加 1000');
    assert.strictEqual(first.balance, 1000, '余额应为 1000');

    const secondSame = await claimRedeemCode(code, sessionA, gameId);
    assert.strictEqual(secondSame.alreadyUsedByMe, true, '同会话重复兑换应幂等返回');
    assert.strictEqual(secondSame.addedTokens, 0, '幂等不重复加量');

    let threw = false;
    try {
      await claimRedeemCode(code, sessionB, gameId);
    } catch {
      threw = true;
    }
    assert.strictEqual(threw, true, '异会话重复兑换应拒绝');

    const wrongGame = await claimRedeemCode('DOES-NOT-EXIST', sessionA, gameId).catch(() => null);
    assert.strictEqual(wrongGame, null, '无效码应抛错');

    console.log('✅ selfcheck-redeem 通过');
  } finally {
    // 清理现场(断言失败也清理)
    await prisma.redeemCode.deleteMany({ where: { code } });
    await prisma.sessionCredit.deleteMany({ where: { sessionId: sessionA, gameId } });
  }
}

main()
  .catch((e) => {
    console.error('❌ selfcheck-redeem 失败:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
