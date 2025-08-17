import { prisma } from '../../db';
import { getPricing, getProviderByModel, calcCostCents } from './ai-pricing';

export type UsageDraft = {
	userId: string;
	requestId: string;
	provider: string;
	model: string;
	isStream: boolean;
	promptTokens: number;
	completionTokens: number;
	estimated?: boolean;
};

export async function ensureSufficientBalance(userId: string, minCents: number): Promise<void> {
	const user = await prisma.user.findUnique({ where: { id: userId }, select: { balanceCents: true } });
	if (!user) throw new Error('User not found');
	if ((user.balanceCents ?? 0) < minCents) throw new Error('Insufficient balance');
}

export async function reserveOrCheck(userId: string, expectedCents: number): Promise<void> {
	await ensureSufficientBalance(userId, expectedCents);
}

export async function billAndRecord(draft: UsageDraft): Promise<{ costCents: number }>{
	const provider = draft.provider || getProviderByModel(draft.model);
	const pricing = getPricing(provider, draft.model);
	const costCents = calcCostCents(draft.promptTokens, draft.completionTokens, pricing);
	
	if (costCents === 0) return { costCents: 0 };

	await prisma.$transaction(async tx => {
		const user = await tx.user.findUnique({ where: { id: draft.userId }, select: { balanceCents: true } });
		if (!user) throw new Error('User not found');
		if ((user.balanceCents ?? 0) < costCents) throw new Error('Insufficient balance');
		await tx.user.update({ where: { id: draft.userId }, data: { balanceCents: { decrement: costCents } } });
		await tx.aiUsage.create({ data: {
			userId: draft.userId,
			provider,
			model: draft.model,
			isStream: draft.isStream,
			promptTokens: draft.promptTokens,
			completionTokens: draft.completionTokens,
			totalTokens: draft.promptTokens + draft.completionTokens,
			costCents,
			currency: 'USD',
			estimated: !!draft.estimated,
			requestId: draft.requestId,
		} });
	});
	return { costCents };
}


