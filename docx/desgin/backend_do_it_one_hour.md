-----

### **终极快速启动：从零到生产级后端基础**

这个指南将带你完成：

1.  **项目搭建**：使用 Fastify + tRPC + Prisma。
2.  **数据库策略**：本地使用 SQLite 快速开发，线上无缝切换到 PostgreSQL。
3.  **认证系统**：实现先进、安全的“魔法链接”无密码登录。
4.  **代码结构**：清晰、可扩展的模块化组织。

#### **第1步：地基搭建 - 项目初始化与依赖安装**

首先，我们来准备好项目目录和所有需要的“建材”。

1.  **创建项目**

    ```bash
    mkdir Basic-Web-Game-Backend
    cd Basic-Web-Game-Backend
    npm init -y
    ```

2.  **安装所有依赖**
    我们一次性安装所有生产和开发依赖。

    ```bash
    # 安装生产依赖
    npm install fastify @trpc/server @fastify/cors prisma @prisma/client zod jsonwebtoken resend

    # 安装开发依赖
    npm install -D typescript @types/node ts-node-dev @types/jsonwebtoken
    ```

      * `resend`: 用于发送魔法链接邮件。
      * `jsonwebtoken`: 用于在用户验证成功后，创建和管理会话（Session）。
      * 其他依赖我们在之前的讨论中已经熟悉。

3.  **初始化 TypeScript**

    ```bash
    npx tsc --init --rootDir src --outDir dist --lib es2020 --module commonjs --esModuleInterop true
    ```

#### **第2步：数据库蓝图 - 兼顾本地与线上的 Prisma 配置**

这是走向专业部署的关键一步。我们将配置 Prisma，让它在本地使用 SQLite，并为线上环境的 PostgreSQL 做好准备。

1.  **初始化 Prisma**

    ```bash
    npx prisma init
    ```

    这会创建 `prisma` 目录和 `.env` 文件。

2.  **编写 `prisma/schema.prisma`**
    这是我们的核心数据模型定义。我们将直接写入最终的、包含无密码认证所需的模型，并配置好双数据库支持。

    ```prisma
    // prisma/schema.prisma

    generator client {
      provider = "prisma-client-js"
    }

    datasource db {
      provider = "postgresql" // 线上环境首选
      url      = env("DATABASE_URL")
    }

    // 用户模型 (密码字段不再是必须的)
    model User {
      id         String      @id @default(cuid())
      email      String      @unique
      createdAt  DateTime    @default(now())
      authTokens AuthToken[]
    }

    // 一次性登录令牌模型
    model AuthToken {
      id        String   @id @default(cuid())
      token     String   @unique // 存储哈希后的令牌，保证安全
      userId    String
      user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
      expiresAt DateTime
      createdAt DateTime @default(now())
    }
    ```

3.  **执行首次迁移**
    Prisma 会读取 `datasource` 块。由于我们还没在线上环境配置 `DATABASE_URL`，它会提示我们本地开发。我们现在使用 SQLite 进行本地开发。

    ```bash
    npx prisma migrate dev --name initial-setup
    ```

    这个命令会：

      * 在 `prisma` 目录下创建一个 `dev.db` 的 SQLite 文件。
      * 创建迁移历史。
      * 生成类型安全的 Prisma Client。

#### **第3步：配置你的秘密武器 (`.env` 文件)**

所有敏感信息都应该放在这里。

```env
# .env

# 1. 本地开发数据库 (Prisma 已自动生成)
# 线上环境时，这个值会被服务器的环境变量覆盖为 PostgreSQL 的链接
DATABASE_URL="file:./dev.db"

# 2. JWT 会话密钥 (用于用户登录后的状态保持)
# 请使用一个长而随机的字符串，例如从 https://www.uuidgenerator.net/ 生成
JWT_SECRET="your_super_long_and_secret_jwt_string_here"

# 3. Resend 邮件服务 API Key (用于发送魔法链接)
# 从 Resend.com 获取
RESEND_API_KEY="re_YourApiKeyFromResend"

# 4. 你的应用对外的公开 URL (用于生成魔法链接)
# 本地测试时用 localhost，上线后换成你的域名
PUBLIC_URL="http://localhost:3000"
```

#### **第4步：构建引擎 - 核心服务器与 tRPC 设置**

现在，我们来编写服务器的骨架和认证的底层逻辑。

1.  **创建 `src` 目录** 和文件结构：

    ```
    src/
    ├── db.ts             # Prisma Client 实例
    ├── trpc.ts           # tRPC 初始化、上下文、中间件
    ├── server.ts         # Fastify 服务器主入口
    └── routers/
        ├── auth.ts       # 认证相关路由 (魔法链接)
        └── user.ts       # 用户相关路由 (受保护)
    ```

2.  **`src/db.ts`**

    ```typescript
    import { PrismaClient } from '@prisma/client';
    export const prisma = new PrismaClient();
    ```

3.  **`src/trpc.ts` (认证核心)**
    这里我们将定义上下文（Context），它负责从请求头中解析出用户信息，以及一个中间件（Middleware）来保护需要登录的路由。

    ```typescript
    import { initTRPC, TRPCError } from '@trpc/server';
    import { createContext } from './server'; // 我们将在 server.ts 中创建它

    type Context = Awaited<ReturnType<typeof createContext>>;

    const t = initTRPC.context<Context>().create();

    const isAuthed = t.middleware(({ ctx, next }) => {
      if (!ctx.user) {
        throw new TRPCError({ code: 'UNAUTHORIZED', message: '请先登录。' });
      }
      return next({
        ctx: { user: ctx.user },
      });
    });

    export const router = t.router;
    export const publicProcedure = t.procedure;
    export const protectedProcedure = t.procedure.use(isAuthed);
    ```

#### **第5步：核心功能 - 实现无密码登录和受保护路由**

这是应用功能的具体实现。

1.  **`src/routers/auth.ts`**

    ```typescript
    import { z } from 'zod';
    import { publicProcedure, router } from '../trpc';
    import { prisma } from '../db';
    import { Resend } from 'resend';
    import { randomBytes, createHash } from 'crypto';
    import * as jwt from 'jsonwebtoken';

    const resend = new Resend(process.env.RESEND_API_KEY);

    export const authRouter = router({
      requestLoginLink: publicProcedure
        .input(z.object({ email: z.string().email() }))
        .mutation(async ({ input: { email } }) => {
          const user = await prisma.user.upsert({
            where: { email },
            update: {},
            create: { email },
          });

          const rawToken = randomBytes(32).toString('hex');
          const hashedToken = createHash('sha256').update(rawToken).digest('hex');
          const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15分钟有效期

          await prisma.authToken.create({
            data: { token: hashedToken, userId: user.id, expiresAt },
          });

          const magicLink = `${process.env.PUBLIC_URL}/api/trpc/auth.verifyMagicToken?token=${rawToken}`;
          
          await resend.emails.send({
            from: 'noreply@yourdomain.com', // 替换成你用 Resend 验证过的域名邮箱
            to: email,
            subject: '登录到 YourApp',
            html: `点击链接登录: <a href="${magicLink}">登录</a>`,
          });

          return { success: true };
        }),

      verifyMagicToken: publicProcedure
        .input(z.object({ token: z.string() }))
        .mutation(async ({ input, ctx }) => {
          const hashedToken = createHash('sha256').update(input.token).digest('hex');
          
          const authToken = await prisma.authToken.findUnique({
            where: { token: hashedToken },
          });

          if (!authToken || new Date() > authToken.expiresAt) {
            throw new Error('链接无效或已过期。');
          }
          
          const sessionToken = jwt.sign(
            { userId: authToken.userId },
            process.env.JWT_SECRET!,
            { expiresIn: '7d' }
          );

          await prisma.authToken.delete({ where: { id: authToken.id } });

          // 在真实应用中，这里应该重定向到前端，并附上 sessionToken
          return { sessionToken };
        }),
    });
    ```

    *注意：`verifyMagicToken` 在这里的实现是直接返回 `sessionToken`，方便API测试。在与前端集成时，通常会重定向到前端页面，如 `res.redirect('https://your-frontend.com/login-success?token=' + sessionToken)`。*

2.  **`src/routers/user.ts`**

    ```typescript
    import { protectedProcedure, router } from '../trpc';
    import { prisma } from '../db';

    export const userRouter = router({
      getMe: protectedProcedure.query(async ({ ctx }) => {
        const user = await prisma.user.findUnique({
          where: { id: ctx.user.userId },
          select: { id: true, email: true, createdAt: true },
        });
        return user;
      }),
    });
    ```

#### **第6步：总装与启动 - 整合并运行服务器**

最后一步，我们将所有部分组装起来。

1.  **`src/server.ts`**
    ```typescript
    import { fastify } from 'fastify';
    import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
    import cors from '@fastify/cors';
    import * as jwt from 'jsonwebtoken';
    import { authRouter } from './routers/auth';
    import { userRouter } from './routers/user';
    import { router } from './trpc';

    // 1. 定义应用的主路由
    const appRouter = router({
      auth: authRouter,
      user: userRouter,
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

    // 4. 启动服务器
    const start = async () => {
      try {
        await server.listen({ port: 3000 });
        console.log('🚀 Server listening on http://localhost:3000');
      } catch (err) {
        server.log.error(err);
        process.exit(1);
      }
    };
    start();
    ```
2.  **在 `package.json` 中添加启动脚本**
    ```json
    "scripts": {
      "dev": "ts-node-dev --respawn --transpile-only src/server.ts"
    },
    ```
3.  **启动！**
    ```bash
    npm run dev
    ```

### **你已拥有一个坚实的基础**

恭喜！你现在拥有一个：

  * **完全类型安全**的后端 API。
  * 采用**无密码认证**，既安全又现代。
  * **开发/生产环境分离**的数据库配置。
  * **清晰的、可扩展的**代码结构。

**下一步？**

  * **连接前端**: 使用 `@trpc/react-query`，在你的 React 应用中享受前所未有的丝滑数据请求体验。
  * **部署**: 将此项目部署到 Railway, Fly.io, 或 Vercel。记得在这些平台上设置好我们在 `.env` 中定义的那些环境变量，特别是 `DATABASE_URL` 要换成线上 PostgreSQL 的链接！