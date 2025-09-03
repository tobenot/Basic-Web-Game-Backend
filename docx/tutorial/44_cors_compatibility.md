# 44. CORS 兼容性：Vercel 与 Nginx 反向代理

## 问题背景：一套代码，两种部署环境

在项目部署时，我们面临两种主流场景，而这两种场景对 CORS (跨域资源共享) 的处理方式要求完全不同：

1.  **Vercel/Serverless 平台**：
    *   Node.js 应用直接暴露给公网。
    *   **必须**由 Node.js 应用自身来处理 CORS 逻辑（即响应 `Access-Control-Allow-Origin` 等HTTP头），否则浏览器会拦截跨域请求。

2.  **自有服务器 + Nginx 反向代理**：
    *   Nginx 作为网关接收所有公网请求，然后转发给在内网端口运行的 Node.js 应用。
    *   在这种架构下，最佳实践是由 Nginx **统一处理** CORS 头部。这样做更高效、更安全，且配置更集中。
    *   此时，Node.js 应用**不应该**再处理 CORS，否则可能导致与 Nginx 的配置冲突（例如，发出重复或矛盾的 CORS 头）。

为了让同一套代码无缝地在这两种环境中运行，我们需要一种机制，让应用能够“感知”自己所处的环境，并据此决定是否启用自己的 CORS 中间件。

## 解决方案：环境变量 `CORS_PROVIDER`

我们引入了一个新的环境变量 `CORS_PROVIDER` 来作为这个决策的开关。

*   **`CORS_PROVIDER` 未设置 (默认情况)**：
    *   适用于 Vercel 和本地开发环境。
    *   应用会**启用**内置的 `@fastify/cors` 中间件，自己负责处理所有跨域请求。

*   **`CORS_PROVIDER = 'NGINX'`**：
    *   适用于自有服务器 + Nginx 的部署环境。
    *   应用在启动时会检测到这个变量，并**禁用**内置的 CORS 中间件，将 CORS 控制权完全交由上游的 Nginx 处理。

## 代码实现

这个逻辑的核心位于 `src/app.ts` 中，代码片段如下：

```typescript
// src/app.ts

// ...

// 只有当环境变量 CORS_PROVIDER 不等于 'NGINX' 时，才启用应用的CORS处理。
if (process.env.CORS_PROVIDER !== 'NGINX') {
  console.log('CORS is handled by the application.');
  if (corsConfig.enabled) {
    server.register(cors, corsPluginOptions);
    console.log('✅ CORS 插件已启用');
    // ...
  } else {
    console.log('⚠️ CORS by application is disabled by config/env.');
  }
} else {
  console.log('CORS is handled by NGINX, application CORS is disabled.');
}

// ...
```
你可以通过启动日志来确认当前 CORS 是由应用处理还是由 Nginx 处理。

## 如何配置 (PM2 / 部署包)

对于使用 PM2 或项目内置部署包的场景，我们已经将这个环境变量集成到了 PM2 的配置文件 `deploy/pm2/ecosystem.config.js` 中。

```javascript
// deploy/pm2/ecosystem.config.js

module.exports = {
  apps: [
    {
      // ...
      env: {
        NODE_ENV: 'production',
        DOTENV_CONFIG_PATH: './.env.publish',
        CORS_PROVIDER: 'NGINX', // 告知应用，CORS由Nginx处理
      },
      // ...
    },
  ],
};
```

**这意味着，只要你是通过 `npm run pack:*` 打包并使用 `deploy.sh` 脚本在自有服务器上部署，这个配置就会自动生效，无需任何额外操作。**

## 总结与关联文档

通过这种方式，我们实现了一套代码，两种部署环境的完美兼容。

*   关于如何在 Nginx 中正确配置 CORS，请参考：[42. Nginx作为Node.js应用反向代理的配置指南](./42_nginx_config.md)
*   关于项目的标准部署流程，请参考：[40. 部署到你自己的服务器](./40_deploy_to_your_server.md)
