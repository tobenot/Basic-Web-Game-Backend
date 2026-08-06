import { FastifyRequest, FastifyReply } from 'fastify';
import * as jwt from 'jsonwebtoken';
import { getAuthConfig } from '../config/auth';

export interface AuthContext {
	user: { userId: string } | null;
	// 携带原始请求,供 tRPC procedure 按 IP 限流
	req: FastifyRequest;
}

export async function createAuthContext(req: FastifyRequest): Promise<AuthContext> {
	const config = getAuthConfig();

	if (!config.enabled) {
		return { user: null, req };
	}

	const authHeader = req.headers.authorization;
	if (!authHeader) {
		return { user: null, req };
	}

	try {
		const token = authHeader.split(' ')[1];
		if (!token) {
			return { user: null, req };
		}

		const user = jwt.verify(token, config.jwtSecret) as { userId: string };
		return { user, req };
	} catch (error) {
		console.warn('JWT验证失败:', error);
		return { user: null, req };
	}
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
