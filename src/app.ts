import { fastify, FastifyInstance } from 'fastify';
import * as fs from 'fs';
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
import { config } from './config';
import { getCorsConfig } from './config/cors';
import { getAuthConfig } from './config/auth';
import { testCors } from './framework/utils/cors-test';

const SENSITIVE_HEADERS = new Set(['authorization', 'cookie', 'set-cookie', 'x-api-key', 'proxy-authorization', 'x-feature-password', 'x-goog-api-key']);
const sanitizeHeaders = (headers: Record<string, any>) => {
	const out: Record<string, any> = {};
	for (const [key, value] of Object.entries(headers)) {
		out[key] = SENSITIVE_HEADERS.has(key.toLowerCase()) ? '[REDACTED]' : value;
	}
	return out;
};
// 去掉 query string，防止魔法链接的一次性 token 落日志
const redactUrl = (u: string) => u.split('?')[0];

export type AppRouter = ReturnType<typeof createAppRouter>;

function createAppRouter() {
	return router({
		auth: authRouter,
		user: userRouter,
		announcement: announcementRouter,
		// corsDebug 仅开发环境注册,避免生产环境泄露 CORS 白名单等内部配置
		...(config.isProduction ? {} : { corsDebug: corsDebugRouter }),
		echo: echoRouter,
	});
}

export async function buildServer(): Promise<FastifyInstance> {
	const appRouter = createAppRouter();
	// 生产在 nginx 反代后面，需要信任 X-Forwarded-For 才能拿到真实客户端 IP 供限流使用
	const server = fastify({ maxParamLength: 5000, trustProxy: true });

	const corsConfig = getCorsConfig();
	const authConfig = getAuthConfig();
	
	console.log(`[CORS Env Check] CORS_PROVIDER = '${process.env.CORS_PROVIDER}'`);

	console.log('🔧 CORS配置:', JSON.stringify(corsConfig, null, 2));
	console.log('🔧 允许的源:', corsConfig.origins);
	// 启动日志只打是否已设置,不打 JWT_SECRET 明文,防止签名密钥落日志
	console.log('🔐 鉴权配置:', JSON.stringify({ ...authConfig, jwtSecret: authConfig.jwtSecret ? '[REDACTED]' : '[NOT SET]' }, null, 2));

	// 现在 getCorsConfig() 已经考虑了 CORS_PROVIDER，所以这里直接检查 enabled
	if (corsConfig.enabled) {
		console.log('CORS is handled by the application.');
		server.register(cors, corsPluginOptions);
		console.log('✅ CORS插件已启用');
		console.log('✅ CORS插件配置:', JSON.stringify(corsPluginOptions, null, 2));

		if (process.env.NODE_ENV !== 'production') {
			console.log('🧪 运行CORS配置测试...');
			testCors();
		}
	} else {
		if (process.env.CORS_PROVIDER === 'NGINX') {
			console.log('CORS is handled by NGINX, application CORS is disabled.');
		} else {
			console.log('⚠️ CORS by application is disabled by config/env.');
		}
	}

	server.addHook('onRequest', async (request, _reply) => {
		console.log(`📥 收到请求: ${request.method} ${redactUrl(request.url)}`);
		console.log(`📥 Origin: ${request.headers.origin}`);
		console.log(`📥 User-Agent: ${request.headers['user-agent']}`);
		console.log(`📥 请求头:`, JSON.stringify(sanitizeHeaders(request.headers), null, 2));
	});

	server.addHook('onResponse', async (request, reply) => {
		console.log(`📤 响应: ${request.method} ${redactUrl(request.url)} -> ${reply.statusCode}`);
		console.log(`📤 响应头:`, JSON.stringify(sanitizeHeaders(reply.getHeaders()), null, 2));
	});

	// 基础安全响应头
	server.addHook('onSend', async (_request, reply) => {
		reply.header('X-Content-Type-Options', 'nosniff');
		reply.header('X-Frame-Options', 'DENY');
		reply.header('Referrer-Policy', 'no-referrer');
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

	// 只手动服务白名单内的演示文件,不再整目录静态托管,杜绝 .env / src / prisma 等被 GET 拉走
	const publicFiles: Record<string, string> = {
		'/test.html': 'text/html',
		'/cors-test.html': 'text/html',
		'/test-cors.html': 'text/html',
		'/announcement.txt': 'text/plain',
	};
	for (const [route, contentType] of Object.entries(publicFiles)) {
		server.get(route, async (_req, reply) => {
			const filePath = join(process.cwd(), route.slice(1));
			if (!fs.existsSync(filePath)) return reply.code(404).send('Not Found');
			return reply.type(contentType).send(fs.createReadStream(filePath));
		});
	}

	server.get('/health', async (_request, reply) => {
		return reply.code(200).send({ status: 'ok' });
	});

	await server.ready();
	return server;
}