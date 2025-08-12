import { buildServer } from './app';
import { config } from './config';
export type { AppRouter } from './app';
import { setupGlobalHttpProxyFromEnv } from './framework/utils/http-proxy';

const start = async () => {
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