import { FastifyRequest, FastifyReply } from 'fastify';
import * as jwt from 'jsonwebtoken';
import { getAuthConfig } from '../config/auth';

export interface AuthContext {
	user: { userId: string } | null;
}

export async function createAuthContext(req: FastifyRequest): Promise<AuthContext> {
	const config = getAuthConfig();
	
	if (!config.enabled) {
		return { user: null };
	}
	
	const authHeader = req.headers.authorization;
	if (!authHeader) {
		return { user: null };
	}
	
	try {
		const token = authHeader.split(' ')[1];
		if (!token) {
			return { user: null };
		}
		
		const user = jwt.verify(token, config.jwtSecret) as { userId: string };
		return { user };
	} catch (error) {
		console.warn('JWT验证失败:', error);
		return { user: null };
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
