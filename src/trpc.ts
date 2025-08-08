import { initTRPC, TRPCError } from '@trpc/server';

export type Context = { user: { userId: string } | null };

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