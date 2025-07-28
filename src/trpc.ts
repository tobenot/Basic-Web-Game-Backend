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