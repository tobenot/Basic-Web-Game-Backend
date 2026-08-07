import { corsPluginOptions } from './cors';
import { requireAuth, optionalAuth, createAuthContext } from './auth';

export { corsPluginOptions, requireAuth, optionalAuth, createAuthContext };

// 可以在这里添加其他中间件
export const middleware = {
  cors: {
    pluginOptions: corsPluginOptions
  },
  auth: {
    requireAuth,
    optionalAuth,
    createAuthContext
  }
};
