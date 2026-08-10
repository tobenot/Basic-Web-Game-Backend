import { TRPCError } from '@trpc/server';
import { prisma } from '../db';
import { getGameConfig } from '../config/games';

export interface RedeemResult {
	addedTokens: number;
	balance: number;
	alreadyUsedByMe?: boolean;
}

// 兑换码领取:原子认领 + 累加余额。幂等:同会话重复提交返回 alreadyUsedByMe,不重复加量。
export async function claimRedeemCode(code: string, sessionId: string, requestedGameId: string): Promise<RedeemResult> {
	const normalizedCode = code.trim().toUpperCase();
	const codeRecord = await prisma.redeemCode.findUnique({ where: { code: normalizedCode } });
	if (!codeRecord) throw new TRPCError({ code: 'BAD_REQUEST', message: '兑换码无效。' });
	if (codeRecord.expiresAt && codeRecord.expiresAt < new Date()) {
		throw new TRPCError({ code: 'BAD_REQUEST', message: '兑换码已过期。' });
	}
	if (codeRecord.gameId !== requestedGameId) {
		throw new TRPCError({ code: 'BAD_REQUEST', message: '该兑换码不适用于此游戏。' });
	}
	if (!getGameConfig(codeRecord.gameId)) {
		throw new TRPCError({ code: 'BAD_REQUEST', message: '兑换码无效。' });
	}

	if (codeRecord.usedAt) {
		if (codeRecord.usedBySessionId === sessionId) {
			const balance = await getBalance(sessionId, codeRecord.gameId);
			return { addedTokens: 0, balance, alreadyUsedByMe: true };
		}
		throw new TRPCError({ code: 'BAD_REQUEST', message: '该兑换码已被使用。' });
	}

	const credit = await prisma.$transaction(async (tx) => {
		// 原子认领:updateMany 的 where 保证并发下只有一方成功
		const claimed = await tx.redeemCode.updateMany({
			where: { id: codeRecord.id, usedBySessionId: null },
			data: { usedBySessionId: sessionId, usedAt: new Date() },
		});
		if (claimed.count === 0) {
			throw new TRPCError({ code: 'BAD_REQUEST', message: '该兑换码已被使用。' });
		}
		return tx.sessionCredit.upsert({
			where: { sessionId_gameId: { sessionId, gameId: codeRecord.gameId } },
			update: { remainingTokens: { increment: codeRecord.tokenAmount } },
			create: { sessionId, gameId: codeRecord.gameId, remainingTokens: codeRecord.tokenAmount },
		});
	});
	return { addedTokens: codeRecord.tokenAmount, balance: credit.remainingTokens };
}

async function getBalance(sessionId: string, gameId: string): Promise<number> {
	const c = await prisma.sessionCredit.findUnique({ where: { sessionId_gameId: { sessionId, gameId } } });
	return c?.remainingTokens ?? 0;
}
