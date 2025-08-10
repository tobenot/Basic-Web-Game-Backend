import { z } from 'zod';
import { publicProcedure, router } from '../trpc';

const inputSchema = z.object({
	message: z.string().min(1).max(1000),
	tags: z.array(z.string().min(1).max(50)).max(10).optional(),
	context: z.array(z.object({
		key: z.string().min(1).max(50),
		value: z.union([z.string().max(200), z.number(), z.boolean()])
	})).max(20).optional()
});

export const echoRouter = router({
	echo: publicProcedure
		.input(inputSchema)
		.mutation(async ({ input }) => {
			return {
				message: input.message,
				messageLength: input.message.length,
				tags: input.tags || [],
				context: input.context || [],
				receivedAt: new Date().toISOString()
			};
		})
});


