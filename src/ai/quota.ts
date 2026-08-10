import { prisma } from '../db';
import { aiBudget, todayKey } from './budget';
import type { GameConfig } from '../config/games';

export interface QuotaCheckResult {
	allowed: boolean;
	code?: 'quota_exceeded' | 'budget_exhausted';
	message?: string;
	remaining: number;
}

// 当日可用 = 每日免费额度 - 当日已用 + 兑换码余额。budget 是全局硬顶,单独判断。
export async function checkQuota(sessionId: string, gameId: string, gameConfig: GameConfig): Promise<QuotaCheckResult> {
	const budget = aiBudget.getStatus();
	if (budget.exhausted) {
		return { allowed: false, code: 'budget_exhausted', message: gameConfig.degradedMessage, remaining: 0 };
	}
	const date = todayKey();
	const [usage, credit] = await Promise.all([
		prisma.quotaUsage.findUnique({ where: { sessionId_gameId_date: { sessionId, gameId, date } } }),
		prisma.sessionCredit.findUnique({ where: { sessionId_gameId: { sessionId, gameId } } }),
	]);
	const used = usage?.usedTokens ?? 0;
	const remaining = gameConfig.dailyFreeTokens + (credit?.remainingTokens ?? 0) - used;
	if (remaining <= 0) {
		return { allowed: false, code: 'quota_exceeded', message: gameConfig.degradedMessage, remaining: 0 };
	}
	return { allowed: true, remaining };
}

// 扣减:先消耗兑换码余额,不足部分记当日用量;同时累计进全局预算。
export async function recordUsage(sessionId: string, gameId: string, tokens: number): Promise<void> {
	const total = Math.max(0, Math.floor(tokens));
	if (total <= 0) return;
	const date = todayKey();
	await prisma.$transaction(async (tx) => {
		const credit = await tx.sessionCredit.findUnique({ where: { sessionId_gameId: { sessionId, gameId } } });
		const creditRemaining = credit?.remainingTokens ?? 0;
		let dailyTokens = total;
		if (creditRemaining > 0) {
			const usedFromCredit = Math.min(creditRemaining, total);
			await tx.sessionCredit.update({
				where: { sessionId_gameId: { sessionId, gameId } },
				data: { remainingTokens: { decrement: usedFromCredit } },
			});
			dailyTokens = total - usedFromCredit;
		}
		await tx.quotaUsage.upsert({
			where: { sessionId_gameId_date: { sessionId, gameId, date } },
			update: { usedTokens: { increment: dailyTokens }, usedRequests: { increment: 1 } },
			create: { sessionId, gameId, date, usedTokens: dailyTokens, usedRequests: 1 },
		});
	});
	aiBudget.record(total);
}

// 流式拿不到 usage 时的估算兜底:输入按字符/4 粗估,输出字符由调用方累计后并入。
export function estimateTokensFromMessages(messages: Array<{ role: string; content: unknown }>): number {
	let chars = 0;
	for (const m of messages) {
		const c = m.content;
		if (typeof c === 'string') {
			chars += c.length;
		} else if (Array.isArray(c)) {
			for (const part of c) {
				if (part && typeof part === 'object' && (part as any).text) chars += String((part as any).text).length;
				else if (part) chars += String(part).length;
			}
		}
	}
	return Math.max(1, Math.ceil(chars / 4));
}
