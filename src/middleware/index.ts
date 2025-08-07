import { corsMiddleware, corsPluginOptions } from './cors';

export { corsMiddleware, corsPluginOptions };

// 可以在这里添加其他中间件
export const middleware = {
  cors: {
    middleware: corsMiddleware,
    pluginOptions: corsPluginOptions
  }
};