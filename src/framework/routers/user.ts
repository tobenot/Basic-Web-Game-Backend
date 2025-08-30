import { protectedProcedure, router } from '../../trpc';
import { prisma } from '../../db';

export const userRouter = router({
	getMe: protectedProcedure.query(async ({ ctx }) => {
		const user = await prisma.user.findUnique({
			where: { id: ctx.user!.userId },
			select: { id: true, email: true, createdAt: true },
		});
		return user;
	}),
});


