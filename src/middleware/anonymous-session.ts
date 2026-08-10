import { FastifyRequest, FastifyReply } from 'fastify';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { getAuthConfig } from '../config/auth';

const COOKIE_NAME = 'bwb_sid';
const MAX_AGE_SEC = 30 * 24 * 60 * 60; // 30 天

interface AnonymousSessionPayload {
	kind: 'anon';
	sid: string;
}

function signSession(sid: string): string {
	const authConfig = getAuthConfig();
	// 复用登录 JWT 同一把密钥与有效期;payload 用 kind:'anon' 与登录身份区分
	return jwt.sign({ kind: 'anon', sid }, authConfig.jwtSecret as any, { expiresIn: authConfig.tokenExpiry as any });
}

export function parseSessionFromCookie(cookieHeader: string | undefined): string | null {
	if (!cookieHeader) return null;
	for (const raw of cookieHeader.split(';')) {
		const idx = raw.indexOf('=');
		if (idx === -1) continue;
		const name = raw.slice(0, idx).trim();
		if (name !== COOKIE_NAME) continue;
		const value = raw.slice(idx + 1).trim();
		try {
			const payload = jwt.verify(value, getAuthConfig().jwtSecret as any) as AnonymousSessionPayload;
			if (payload.kind === 'anon' && payload.sid) return payload.sid;
		} catch {
			return null; // 无效/过期 JWT,当作无会话
		}
	}
	return null;
}

/**
 * 当前请求的匿名会话 ID。优先取本请求刚签发的(request.anonymousSessionId):
 * 首次请求时 cookie 还没回到浏览器,但 onRequest hook 已把新 sid 存到 request 上。
 */
export function getSessionId(request: FastifyRequest): string | null {
	const stashed = (request as any).anonymousSessionId as string | undefined;
	if (stashed) return stashed;
	return parseSessionFromCookie(request.headers.cookie);
}

export function ensureAnonymousSession(request: FastifyRequest, reply: FastifyReply): void {
	const existing = getSessionId(request);
	if (existing) return;

	const sid = randomUUID();
	(request as any).anonymousSessionId = sid;

	const isProd = process.env.NODE_ENV === 'production';
	// R1: 第三方 iframe 游戏(itch.io 已在 CORS 白名单)需要 SameSite=None + Secure 才能在跨站请求里带 cookie;
	// 牺牲 CSRF 防护,由「每日额度封顶」兜底损失。所有游戏站同域部署时设 ANON_COOKIE_SAMESITE=Lax 更稳。
	// 默认: 生产 None,开发 Lax。
	const sameSite = (process.env.ANON_COOKIE_SAMESITE || (isProd ? 'None' : 'Lax')) as 'Lax' | 'None';

	const cookie = [
		`${COOKIE_NAME}=${signSession(sid)}`,
		'Path=/',
		'HttpOnly',
		`Max-Age=${MAX_AGE_SEC}`,
		isProd ? 'Secure' : '',
		sameSite === 'None' ? 'SameSite=None' : 'SameSite=Lax',
	].filter(Boolean).join('; ');

	reply.header('Set-Cookie', cookie);
}
