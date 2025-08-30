// 环境变量配置
export const config = {
  // 服务器配置
  server: {
    port: Number(process.env.PORT) || 3000,
    host: process.env.HOST || 'localhost',
  },
  
  // 前端配置
  frontend: {
    // 本地开发前端URL
    localDev: process.env.FRONTEND_LOCAL_URL || 'http://localhost:5173',
    // 生产环境前端URL
    production: process.env.FRONTEND_PRODUCTION_URL || 'https://tobenot.top/Basic-Web-Game/#/demo-with-backend',
  },
  
  // 服务器URL配置
  backend: {
    // 本地开发服务器URL
    localDev: process.env.BACKEND_LOCAL_URL || 'http://localhost:3000',
    // 生产环境服务器URL
    production: process.env.BACKEND_PRODUCTION_URL || 'https://bwb.tobenot.top',
  },
  
  // 邮件配置
  email: {
    from: process.env.EMAIL_FROM || 'noreply@sendmail.tobenot.top',
    fromName: process.env.EMAIL_FROM_NAME || 'YourApp',
  },

  // 登录与验证码配置（可通过环境变量覆盖）
  authFlow: {
    // 单封邮件同时包含魔法链接与验证码
    dualInOneEmail: process.env.AUTH_DUAL_IN_ONE_EMAIL !== 'false',
    // 魔法链接有效期（秒）
    magicLinkTtlSec: Number(process.env.AUTH_MAGIC_TTL_SEC || 15 * 60),
    // 邮件验证码有效期（秒）
    otpTtlSec: Number(process.env.AUTH_OTP_TTL_SEC || 10 * 60),
    // 验证码长度
    otpLength: Number(process.env.AUTH_OTP_LENGTH || 6),
    // 验证码最大尝试次数
    otpMaxAttempts: Number(process.env.AUTH_OTP_MAX_ATTEMPTS || 5),
  },
  
  // 环境判断
  isProduction: process.env.NODE_ENV === 'production',
  
  // 获取当前环境的前端URL
  getFrontendUrl: () => {
    return config.isProduction ? config.frontend.production : config.frontend.localDev;
  },
  
  // 获取当前环境的服务器URL
  getBackendUrl: () => {
    return config.isProduction ? config.backend.production : config.backend.localDev;
  },
  
  // 获取CORS允许的源
  getCorsOrigins: () => {
    const origins = [
      config.frontend.localDev,
      config.backend.localDev,
      config.frontend.production,
      config.backend.production,
      'http://localhost:5173', // 兼容其他可能的本地端口
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
      'https://tobenot.top', // 前端域名
      'https://bwb.tobenot.top', // 后端域名
    ];
    
    // 从环境变量添加额外的CORS域名
    const additionalOrigins = process.env.CORS_ADDITIONAL_ORIGINS;
    if (additionalOrigins) {
      origins.push(...additionalOrigins.split(',').map(origin => origin.trim()));
    }
    
    if (config.isProduction) {
      origins.push(config.frontend.production);
      origins.push(config.backend.production);
    }
    
    return origins;
  }
};