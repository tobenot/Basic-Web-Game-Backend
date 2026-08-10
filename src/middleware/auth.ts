import { FastifyRequest, FastifyReply } from 'fastify';
import * as jwt from 'jsonwebtoken';
import { getAuthConfig } from '../config/auth';
import { getSessionId } from './anonymous-session';

export interface AuthContext {
	user: { userId: string } | null;
	// 匿名会话 ID(cookie JWT):登录用户也有,用于额度/兑换码/人机验证
	sessionId?: string;
	// 携带原始请求,供 tRPC procedure 按 IP 限流
	req: FastifyRequest;
}

export async function createAuthContext(req: FastifyRequest): Promise<AuthContext> {
	const config = getAuthConfig();
	let user: { userId: string } | null = null;

	if (config.enabled) {
		const authHeader = req.headers.authorization;
		if (authHeader) {
			try {
				const token = authHeader.split(' ')[1];
				if (token) {
					user = jwt.verify(token, config.jwtSecret) as { userId: string };
				}
			} catch (error) {
				console.warn('JWT验证失败:', error);
			}
		}
	}

	// 登录身份(受保护 procedure)与匿名会话(额度/兑换码)并存,互不排斥
	const sessionId = getSessionId(req);
	return { user, sessionId: sessionId ?? undefined, req };
}

export function requireAuth() {
	return async (request: FastifyRequest, reply: FastifyReply) => {
		const config = getAuthConfig();
		
		if (!config.enabled) {
			return;
		}
		
		const context = await createAuthContext(request);
		
		if (!context.user) {
			return reply.code(401).send({
				error: 'Unauthorized',
				message: '需要登录才能访问此资源'
			});
		}
	};
}

export function optionalAuth() {
	return async (request: FastifyRequest, reply: FastifyReply) => {
		const context = await createAuthContext(request);
		(request as any).authContext = context;
	};
}
