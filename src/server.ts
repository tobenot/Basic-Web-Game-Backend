import { fastify } from 'fastify';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import cors from '@fastify/cors';
import * as jwt from 'jsonwebtoken';
import { authRouter } from './routers/auth';
import { userRouter } from './routers/user';
import { announcementRouter } from './routers/announcement';
import { corsDebugRouter } from './routers/cors-debug';
import { router } from './trpc';
import { join } from 'path';
import { config } from './config';
import { corsPluginOptions, corsMiddleware } from './middleware';
import { getCorsConfig } from './config/cors';
import { testCors } from './utils/cors-test';

// 1. 定义应用的主路由
const appRouter = router({
  auth: authRouter,
  user: userRouter,
  announcement: announcementRouter,
  corsDebug: corsDebugRouter, // CORS调试路由
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

// <template:bootstrap>
// 3. 创建并配置 Fastify 服务器
const server = fastify({ maxParamLength: 5000 });

// 使用新的CORS中间件配置
const corsConfig = getCorsConfig();
console.log('🔧 CORS配置:', JSON.stringify(corsConfig, null, 2));
console.log('🔧 允许的源:', corsConfig.origins);

if (corsConfig.enabled) {
  server.register(cors, corsPluginOptions);
  // 关键：在最早阶段拦截并处理所有请求（包含无路由匹配的 OPTIONS 预检）
  server.addHook('onRequest', corsMiddleware);
  console.log('✅ CORS中间件已启用');
  
  // 在开发环境下运行CORS测试
  if (process.env.NODE_ENV !== 'production') {
    console.log('🧪 运行CORS配置测试...');
    testCors();
  }
} else {
  console.log('⚠️ CORS中间件已禁用');
}

// 添加请求日志中间件
server.addHook('onRequest', async (request, reply) => {
  console.log(`📥 收到请求: ${request.method} ${request.url}`);
  console.log(`📥 Origin: ${request.headers.origin}`);
  console.log(`📥 User-Agent: ${request.headers['user-agent']}`);
  console.log(`📥 请求头:`, JSON.stringify(request.headers, null, 2));
});

// 添加响应日志中间件
server.addHook('onResponse', async (request, reply) => {
  console.log(`📤 响应: ${request.method} ${request.url} -> ${reply.statusCode}`);
  console.log(`📤 响应头:`, JSON.stringify(reply.getHeaders(), null, 2));
});

server.register(fastifyTRPCPlugin, {
  prefix: '/api/trpc',
  trpcOptions: { 
    router: appRouter, 
    createContext,
    onError: ({ error, path, type, ctx }: { error: any; path?: string; type?: string; ctx?: any }) => {
      console.error('❌ tRPC Error:', {
        path,
        type,
        error: error.message,
        code: error.code,
        stack: error.stack,
        ctx: ctx ? '有上下文' : '无上下文'
      });
    }
  },
});

// 4. 注册静态文件服务
server.register(require('@fastify/static'), {
  root: join(__dirname, '..'),
  prefix: '/'
});
// </template:bootstrap>

// <template:startup>
// 5. 启动服务器
const start = async () => {
  console.log('🔍 Starting server...');
  console.log('🔍 环境变量检查:');
  console.log('  - NODE_ENV:', process.env.NODE_ENV);
  console.log('  - PORT:', process.env.PORT);
  console.log('  - HOST:', process.env.HOST);
  console.log('  - JWT_SECRET:', process.env.JWT_SECRET ? '已设置' : '未设置');
  console.log('  - RESEND_API_KEY:', process.env.RESEND_API_KEY ? '已设置' : '未设置');
  
  try {
    console.log(`🔍 About to start listening on port ${config.server.port}...`);
    await server.listen({ port: config.server.port, host: config.server.host });
    console.log(`🚀 Server listening on ${config.getBackendUrl()}`);
    console.log(`📱 Test page available at ${config.getBackendUrl()}/test.html`);
    console.log('✅ 服务器启动成功，所有路由已注册');
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
// </template:startup> 