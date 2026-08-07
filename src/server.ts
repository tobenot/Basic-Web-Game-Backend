import { buildServer } from './app';
import { config } from './config';
export type { AppRouter } from './app';
import { setupGlobalHttpProxyFromEnv } from './framework/utils/http-proxy';

const start = async () => {
  // 非开发环境必须设置非默认的 JWT_SECRET,否则拒绝启动。
  // 用默认值 'your-secret-key' 签名 = 任何人都能伪造 JWT;
  // 这里不看 NODE_ENV==='production',避免 NODE_ENV 漏设/误拼时静默落到默认密钥。
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret === 'your-secret-key') {
    if (process.env.NODE_ENV !== 'development') {
      console.error('❌ FATAL: 非开发环境必须设置非默认的 JWT_SECRET,拒绝启动。');
      process.exit(1);
    }
  }

  console.log('🔍 Starting server...');
  console.log('🔍 环境变量检查:');
  console.log('  - NODE_ENV:', process.env.NODE_ENV);
  console.log('  - PORT:', process.env.PORT);
  console.log('  - HOST:', process.env.HOST);
  console.log('  - JWT_SECRET:', process.env.JWT_SECRET ? '已设置' : '未设置');
  console.log('  - RESEND_API_KEY:', process.env.RESEND_API_KEY ? '已设置' : '未设置');

  try {
    setupGlobalHttpProxyFromEnv();
    const server = await buildServer();
    console.log(`🔍 About to start listening on port ${config.server.port}...`);
    await server.listen({ port: config.server.port, host: config.server.host });
    console.log(`🚀 Server listening on ${config.getBackendUrl()}`);
    console.log(`📱 Test page available at ${config.getBackendUrl()}/test.html`);
    console.log('✅ 服务器启动成功，所有路由已注册');
  } catch (err) {
    console.error('❌ Error starting server:', err);
    process.exit(1);
  }
};

start().catch(err => {
  console.error('❌ Unhandled error in start():', err);
  process.exit(1);
}); 