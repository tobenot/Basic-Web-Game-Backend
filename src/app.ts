import { fastify, FastifyInstance } from 'fastify';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import cors from '@fastify/cors';
import * as jwt from 'jsonwebtoken';
import { authRouter } from './framework/routers/auth';
import { userRouter } from './framework/routers/user';
import { announcementRouter } from './framework/routers/announcement';
import { corsDebugRouter } from './framework/routers/cors-debug';
import { echoRouter } from './framework/routers/echo';
import { router } from './trpc';
import { join } from 'path';
import { corsPluginOptions, createAuthContext } from './middleware';
import { getCorsConfig } from './config/cors';
import { getAuthConfig } from './config/auth';
import { testCors } from './framework/utils/cors-test';

export type AppRouter = ReturnType<typeof createAppRouter>;

function createAppRouter() {
	return router({
		auth: authRouter,
		user: userRouter,
		announcement: announcementRouter,
		corsDebug: corsDebugRouter,
		echo: echoRouter,
	});
}

export async function buildServer(): Promise<FastifyInstance> {
	const appRouter = createAppRouter();
	const server = fastify({ maxParamLength: 5000 });

	const corsConfig = getCorsConfig();
	const authConfig = getAuthConfig();
	
	console.log('🔧 CORS配置:', JSON.stringify(corsConfig, null, 2));
	console.log('🔧 允许的源:', corsConfig.origins);
	console.log('🔐 鉴权配置:', JSON.stringify(authConfig, null, 2));

	// 只有当环境变量 CORS_PROVIDER 不等于 'NGINX' 时，才启用应用的CORS处理。
	// 这意味着在 Vercel 和本地开发时，它会默认启用。
	if (process.env.CORS_PROVIDER !== 'NGINX') {
		console.log('CORS is handled by the application.'); // 加一条日志方便调试
		if (corsConfig.enabled) {
			server.register(cors, corsPluginOptions);
			console.log('✅ CORS插件已启用');
			console.log('✅ CORS插件配置:', JSON.stringify(corsPluginOptions, null, 2));

			if (process.env.NODE_ENV !== 'production') {
				console.log('🧪 运行CORS配置测试...');
				testCors();
			}
		} else {
			console.log('⚠️ CORS by application is disabled by config/env.');
		}
	} else {
		console.log('CORS is handled by NGINX, application CORS is disabled.'); // 加上日志
	}

	server.addHook('onRequest', async (request, _reply) => {
		console.log(`📥 收到请求: ${request.method} ${request.url}`);
		console.log(`📥 Origin: ${request.headers.origin}`);
		console.log(`📥 User-Agent: ${request.headers['user-agent']}`);
		console.log(`📥 请求头:`, JSON.stringify(request.headers, null, 2));
	});

	server.addHook('onResponse', async (request, reply) => {
		console.log(`📤 响应: ${request.method} ${request.url} -> ${reply.statusCode}`);
		console.log(`📤 响应头:`, JSON.stringify(reply.getHeaders(), null, 2));
	});

	server.register(fastifyTRPCPlugin, {
		prefix: '/api/trpc',
		trpcOptions: {
			router: appRouter,
			createContext: async ({ req }: { req: any }) => {
				return await createAuthContext(req);
			},
			onError: ({ error, path, type, ctx }: { error: any; path?: string; type?: string; ctx?: any }) => {
				console.error('❌ tRPC Error:', {
					path,
					type,
					error: error.message,
					code: error.code,
					stack: error.stack,
					ctx: ctx ? '有上下文' : '无上下文',
				});
			},
		},
	});

	server.register(require('./framework/routers/llm-proxy').llmProxyRoutes);

	server.register(require('@fastify/static'), {
		root: process.cwd(),
		prefix: '/',
	});

	server.get('/health', async (_request, reply) => {
		return reply.code(200).send({ status: 'ok' });
	});

	await server.ready();
	return server;
}