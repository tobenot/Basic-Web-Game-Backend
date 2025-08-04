// 环境变量配置
export const config = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || 'localhost',
  },
  
  // 前端配置
  frontend: {
    // 本地开发前端URL
    localDev: process.env.FRONTEND_LOCAL_URL || 'http://localhost:5174',
    // 生产环境前端URL
    production: process.env.FRONTEND_PRODUCTION_URL || 'https://tobenot.top/Basic-Web-Game/#/demo-with-backend',
  },
  
  // 服务器URL配置
  backend: {
    // 本地开发服务器URL
    localDev: process.env.BACKEND_LOCAL_URL || 'http://localhost:3000',
    // 生产环境服务器URL
    production: process.env.BACKEND_PRODUCTION_URL || 'https://api.tobenot.top',
  },
  
  // 邮件配置
  email: {
    from: process.env.EMAIL_FROM || 'noreply@sendmail.tobenot.top',
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
      'http://localhost:5173', // 兼容其他可能的本地端口
      'http://127.0.0.1:5173',
      'http://127.0.0.1:5174',
    ];
    
    if (config.isProduction) {
      origins.push(config.frontend.production);
      origins.push(config.backend.production);
    }
    
    return origins;
  }
};