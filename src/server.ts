import { fastify } from 'fastify';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import cors from '@fastify/cors';
import * as jwt from 'jsonwebtoken';
import { authRouter } from './routers/auth';
import { userRouter } from './routers/user';
import { announcementRouter } from './routers/announcement';
import { router } from './trpc';
import { join } from 'path';

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
server.register(cors);
server.register(fastifyTRPCPlugin, {
  prefix: '/api/trpc',
  trpcOptions: { router: appRouter, createContext },
});

// 4. 注册静态文件服务
server.register(require('@fastify/static'), {
  root: join(__dirname, '..'),
  prefix: '/'
});

// 5. 启动服务器
const start = async () => {
  try {
    await server.listen({ port: 3000 });
    console.log('🚀 Server listening on http://localhost:3000');
    console.log('📱 Test page available at http://localhost:3000/test.html');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};
start(); 