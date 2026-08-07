import { getCorsConfig } from '../config/cors';

// 创建CORS插件配置
// CORS 完全由 @fastify/cors 插件处理(见 app.ts),不再手写 CORS 中间件(已删除 corsMiddleware)
export const corsPluginOptions = (() => {
	const corsConfig = getCorsConfig();
	return {
		origin: corsConfig.origins,
		methods: corsConfig.methods,
		allowedHeaders: corsConfig.allowedHeaders,
		credentials: corsConfig.credentials,
		maxAge: corsConfig.maxAge,
		preflightContinue: false,
		optionsSuccessStatus: 204,
		hideOptionsRoute: false
	};
})();
