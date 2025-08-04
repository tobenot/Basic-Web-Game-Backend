import { fastify } from 'fastify';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import cors from '@fastify/cors';
import * as jwt from 'jsonwebtoken';
import { authRouter } from './routers/auth';
import { userRouter } from './routers/user';
import { announcementRouter } from './routers/announcement';
import { router } from './trpc';
import { join } from 'path';
import { config } from './config';

// 1. 定义应用的主路由
const appRouter = router({
  auth: authRouter,
  user: userRouter,
  announcement: announcementRouter,
});
export type AppRouter = typeof appRouter;

// 2. 创建上下文函数，用于从请求中提取用户信息
export async function createContext({ req }: { req: any }) {
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
}

// 3. 创建并配置 Fastify 服务器
const server = fastify({ maxParamLength: 5000 });
server.register(cors, {
  origin: config.getCorsOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400
});

// 添加OPTIONS请求处理器
server.addHook('onRequest', async (request, reply) => {
  if (request.method === 'OPTIONS') {
    reply.header('Access-Control-Allow-Origin', request.headers.origin || '*');
    reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    reply.header('Access-Control-Allow-Credentials', 'true');
    reply.header('Access-Control-Max-Age', '86400');
    reply.send();
  }
});

server.register(fastifyTRPCPlugin, {
  prefix: '/api/trpc',
  trpcOptions: { 
    router: appRouter, 
    createContext,
    onError: ({ error }: { error: any }) => {
      console.error('tRPC Error:', error);
    }
  },
});

// 4. 注册静态文件服务
server.register(require('@fastify/static'), {
  root: join(__dirname, '..'),
  prefix: '/'
});

// 5. 启动服务器
const start = async () => {
  console.log('🔍 Starting server...');
  try {
    console.log(`🔍 About to start listening on port ${config.server.port}...`);
    await server.listen({ port: config.server.port, host: config.server.host });
    console.log(`🚀 Server listening on ${config.getBackendUrl()}`);
    console.log(`📱 Test page available at ${config.getBackendUrl()}/test.html`);
  } catch (err) {
    console.error('❌ Error starting server:', err);
    server.log.error(err);
    process.exit(1);
  }
};

console.log('🔍 About to call start()...');
start().catch(err => {
  console.error('❌ Unhandled error in start():', err);
  process.exit(1);
}); 