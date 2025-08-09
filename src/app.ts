import { fastify, FastifyInstance } from 'fastify';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import cors from '@fastify/cors';
import * as jwt from 'jsonwebtoken';
import { authRouter } from './routers/auth';
import { userRouter } from './routers/user';
import { announcementRouter } from './routers/announcement';
import { corsDebugRouter } from './routers/cors-debug';
import { router } from './trpc';
import { join } from 'path';
import { corsPluginOptions, corsMiddleware } from './middleware';
import { getCorsConfig } from './config/cors';
import { testCors } from './utils/cors-test';

export type AppRouter = ReturnType<typeof createAppRouter>;

function createAppRouter() {
  return router({
    auth: authRouter,
    user: userRouter,
    announcement: announcementRouter,
    corsDebug: corsDebugRouter,
  });
}

export async function buildServer(): Promise<FastifyInstance> {
  const appRouter = createAppRouter();
  const server = fastify({ maxParamLength: 5000 });

  const corsConfig = getCorsConfig();
  console.log('🔧 CORS配置:', JSON.stringify(corsConfig, null, 2));
  console.log('🔧 允许的源:', corsConfig.origins);

  if (corsConfig.enabled) {
    server.register(cors, corsPluginOptions);
    server.addHook('onRequest', corsMiddleware);
    console.log('✅ CORS中间件已启用');

    if (process.env.NODE_ENV !== 'production') {
      console.log('🧪 运行CORS配置测试...');
      testCors();
    }
  } else {
    console.log('⚠️ CORS中间件已禁用');
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
        const authHeader = req.headers.authorization;
        if (authHeader) {
          try {
            const token = authHeader.split(' ')[1];
            const user = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
            return { user };
          } catch {
            return { user: null };
          }
        }
        return { user: null };
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

  // Register OpenAI-compatible proxy routes (both /v1/... and /api/v1/... aliases)
  server.register(require('./routers/llm-proxy').llmProxyRoutes);
  server.register((instance: any, _opts: any, done: any) => {
    instance.post('/api/v1/chat/completions', (req: any, reply: any) => {
      // delegate to the main handler by internally calling the same logic
      (instance as any).inject({
        method: 'POST',
        url: '/v1/chat/completions',
        payload: req.body,
        headers: req.headers,
      }).then((res: any) => {
        reply
          .code(res.statusCode)
          .headers(res.headers)
          .send(res.rawPayload || res.payload);
      }).catch((err: any) => {
        reply.code(500).send({ error: String(err?.message || err) });
      });
    });
    done();
  });


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