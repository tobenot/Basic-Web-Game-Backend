import { z } from 'zod';
import { publicProcedure, router } from '../trpc';
import { getCorsConfig, isOriginAllowed } from '../config/cors';

export const corsDebugRouter = router({
  // 获取CORS配置信息
  getConfig: publicProcedure
    .query(() => {
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

  // 测试特定源的CORS配置
  testOrigin: publicProcedure
    .input(z.object({
      origin: z.string()
    }))
    .query(({ input }) => {
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

  // 测试预检请求
  testPreflight: publicProcedure
    .input(z.object({
      origin: z.string(),
      method: z.string().optional(),
      headers: z.array(z.string()).optional()
    }))
    .query(({ input }) => {
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

  // 简单的健康检查端点
  health: publicProcedure
    .query(() => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        cors: {
          enabled: getCorsConfig().enabled,
          environment: process.env.NODE_ENV || 'development'
        }
      };
    })
});