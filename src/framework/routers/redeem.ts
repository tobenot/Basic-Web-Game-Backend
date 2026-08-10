import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure, router, Context } from '../../trpc';
import { claimRedeemCode } from '../../ai/redeem';
import { getGameConfig } from '../../config/games';

export const redeemRouter = router({
	redeemCode: publicProcedure
		.input(z.object({ code: z.string().trim().min(1).max(64), gameId: z.string().min(1).max(64) }))
		.mutation(async ({ input, ctx }: { input: { code: string; gameId: string }; ctx: Context }) => {
			if (!ctx.sessionId) {
				throw new TRPCError({ code: 'UNAUTHORIZED', message: '缺少会话，请刷新页面后重试。' });
			}
			if (!getGameConfig(input.gameId)) {
				throw new TRPCError({ code: 'BAD_REQUEST', message: '未知的游戏 ID。' });
			}
			return claimRedeemCode(input.code, ctx.sessionId, input.gameId);
		}),
});
