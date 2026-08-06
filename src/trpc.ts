import { initTRPC, TRPCError } from '@trpc/server';
import type { FastifyRequest } from 'fastify';
import { isTRPCAuthRequired } from './config/auth';

export type Context = { user: { userId: string } | null; req: FastifyRequest };

const t = initTRPC.context<Context>().create();

const isAuthed = t.middleware(({ ctx, next }) => {
  if (isTRPCAuthRequired() && !ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: '请先登录。' });
  }
  return next({ ctx });
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(isAuthed);