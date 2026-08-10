import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure, router, Context } from '../../trpc';

// 内存 Set 记录已验证会话;ponytail: 单实例够用,多实例需换 Redis。
// 每天清一次,额度本来就按日,清了无碍;Set 只在开关开启时增长。
const verifiedSessions = new Set<string>();

const isTurnstileEnabled = () => process.env.TURNSTILE_ENABLED === 'true';

// 未开启验证时永远放行(开发环境不打搅);开启后未验证的会话需要先 verifyCode。
export function isSessionTurnstileVerified(sessionId: string): boolean {
	return !isTurnstileEnabled() || verifiedSessions.has(sessionId);
}

export const turnstileRouter = router({
	verifyCode: publicProcedure
		.input(z.object({ token: z.string().min(1).max(2048) }))
		.mutation(async ({ input, ctx }: { input: { token: string }; ctx: Context }) => {
			if (!isTurnstileEnabled()) {
				return { verified: true, enabled: false };
			}
			const secret = process.env.TURNSTILE_SECRET_KEY;
			if (!secret) {
				throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Turnstile 未配置。' });
			}
			const sessionId = ctx.sessionId;
			if (!sessionId) {
				throw new TRPCError({ code: 'UNAUTHORIZED', message: '缺少会话，请刷新页面后重试。' });
			}

			const form = new URLSearchParams({ secret, response: input.token });
			const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
				method: 'POST',
				body: form,
			});
			const data = (await res.json()) as { success: boolean; 'error-codes'?: string[] };
			if (!data.success) {
				throw new TRPCError({ code: 'UNAUTHORIZED', message: '人机验证失败，请重试。' });
			}
			verifiedSessions.add(sessionId);
			return { verified: true, enabled: true };
		}),
});

// 每日清理,防止 Set 无限增长
setInterval(() => {
	verifiedSessions.clear();
}, 24 * 60 * 60 * 1000).unref();
