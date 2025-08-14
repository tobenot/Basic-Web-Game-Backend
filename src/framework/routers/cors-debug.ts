import { z } from 'zod';
import { publicProcedure, router } from '../../trpc';
import { getCorsConfig, isOriginAllowed } from '../../config/cors';

export const corsDebugRouter = router({
	getConfig: publicProcedure.query(() => {
		const corsConfig = getCorsConfig();
		return {
			enabled: corsConfig.enabled,
			origins: corsConfig.origins,
			methods: corsConfig.methods,
			allowedHeaders: corsConfig.allowedHeaders,
			credentials: corsConfig.credentials,
			maxAge: corsConfig.maxAge,
			environment: process.env.NODE_ENV || 'development'
		};
	}),

	testOrigin: publicProcedure
		.input(z.object({ origin: z.string() }))
		.query(({ input }: { input: { origin: string } }) => {
			const corsConfig = getCorsConfig();
			const allowed = isOriginAllowed(input.origin, corsConfig);
			return {
				origin: input.origin,
				allowed,
				corsConfig: {
					enabled: corsConfig.enabled,
					origins: corsConfig.origins,
					environment: process.env.NODE_ENV || 'development'
				}
			};
		}),

	testPreflight: publicProcedure
		.input(z.object({
			origin: z.string(),
			method: z.string().optional(),
			headers: z.array(z.string()).optional()
		}))
		.query(({ input }: { input: { origin: string; method?: string; headers?: string[] } }) => {
			const corsConfig = getCorsConfig();
			const originAllowed = isOriginAllowed(input.origin, corsConfig);
			return {
				origin: input.origin,
				originAllowed,
				method: input.method || 'GET',
				headers: input.headers || [],
				corsConfig: {
					enabled: corsConfig.enabled,
					methods: corsConfig.methods,
					allowedHeaders: corsConfig.allowedHeaders,
					credentials: corsConfig.credentials
				}
			};
		}),

	health: publicProcedure.query(() => {
		return {
			status: 'ok',
			timestamp: new Date().toISOString(),
			cors: {
				enabled: getCorsConfig().enabled,
				environment: process.env.NODE_ENV || 'development'
			}
		};
	}),
});


