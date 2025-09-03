# 🔧 CORS问题修复指南

## 问题描述

你的后端遇到了经典的CORS问题：**后端日志显示一切正常，但浏览器依然报了CORS错误**。

## 问题根因

### 1. 中间件冲突
- **Fastify CORS插件**：`server.register(cors, corsPluginOptions)`
- **自定义CORS中间件**：`server.addHook('onRequest', corsMiddleware)`
- **路由级手动CORS头**：在LLM代理路由中手动设置CORS头

这三种CORS处理方式同时存在，导致冲突。

### 2. 预检请求处理不当
对于复杂的跨域请求（如带有 `Content-Type: application/json` 的 `POST` 请求），浏览器会先发送 `OPTIONS` 预检请求。如果服务器没有正确处理这个请求，浏览器就会直接报CORS错误。

## 修复方案

### 1. 统一CORS处理
- 移除自定义CORS中间件
- 移除路由级手动CORS头设置
- 只使用Fastify CORS插件统一处理

### 2. 优化CORS插件配置
```typescript
export const corsPluginOptions = (() => {
	const corsConfig = getCorsConfig();
	return {
		origin: corsConfig.origins,
		methods: corsConfig.methods,
		allowedHeaders: corsConfig.allowedHeaders,
		credentials: corsConfig.credentials,
		maxAge: corsConfig.maxAge,
		preflightContinue: false,        // 重要：不继续处理预检请求
		optionsSuccessStatus: 204,       // 预检请求返回204状态码
		hideOptionsRoute: false          // 显示OPTIONS路由
	};
})();
```

## 测试步骤

### 1. 启动后端服务
```bash
npm run dev
# 或
npm start
```

### 2. 使用测试页面
打开 `test-cors.html` 文件，点击测试按钮：

- **测试 OPTIONS 预检请求**：验证预检请求是否正确处理
- **测试 POST 请求**：验证实际请求是否通过CORS检查
- **测试流式请求**：验证流式响应是否正常工作

### 3. 使用curl命令测试
```bash
# 测试预检请求
curl -v -X OPTIONS \
  -H "Origin: http://localhost:3001" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" \
  http://localhost:3000/v1/chat/completions

# 测试实际请求
curl -v -X POST \
  -H "Origin: http://localhost:3001" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-3.5-turbo","messages":[{"role":"user","content":"test"}]}' \
  http://localhost:3000/v1/chat/completions
```

## 预期结果

### 成功的OPTIONS响应应该包含：
```
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: http://localhost:3001
Access-Control-Allow-Methods: GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS
Access-Control-Allow-Headers: Content-Type,Authorization,x-trpc-source,X-Requested-With,Accept,Origin,x-api-key,x-goog-api-key,x-feature-password
Access-Control-Allow-Credentials: true
Access-Control-Max-Age: 86400
Vary: Origin, Access-Control-Request-Method, Access-Control-Request-Headers
```

### 成功的POST响应应该包含：
```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: http://localhost:3001
Access-Control-Allow-Credentials: true
Content-Type: application/json
```

## 常见问题排查

### 1. 如果仍然有CORS错误
- 检查后端服务是否重启
- 检查浏览器控制台的具体错误信息
- 确认请求的Origin是否在允许列表中

### 2. 如果预检请求失败
- 检查CORS插件是否正确注册
- 检查CORS配置中的origins数组
- 确认OPTIONS路由是否被正确处理

### 3. 如果流式响应有问题
- 检查响应头设置
- 确认SSE格式是否正确
- 验证浏览器是否支持EventSource

## 配置验证

### 环境变量检查
确保以下环境变量正确设置：
```bash
# 前端本地开发URL
FRONTEND_LOCAL_URL=http://localhost:3001

# 后端本地开发URL  
BACKEND_LOCAL_URL=http://localhost:3000

# CORS启用状态
CORS_ENABLED=true

# 额外的CORS域名（可选）
CORS_ADDITIONAL_ORIGINS=http://localhost:3002,http://127.0.0.1:3001
```

### 配置文件检查
确认 `src/config/cors.ts` 中的配置：
```typescript
export function getCorsConfig(): CorsConfig {
	return {
		enabled: process.env.CORS_ENABLED !== 'false',
		origins: [
			'http://localhost:5173',
			'http://localhost:3001',  // 确保包含你的前端端口
			'http://127.0.0.1:5173',
			// ... 其他域名
		],
		methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
		allowedHeaders: [
			'Content-Type', 
			'Authorization', 
			'x-trpc-source', 
			'X-Requested-With', 
			'Accept',
			'Origin',
			'x-api-key',
			'x-goog-api-key',
			'x-feature-password'
		],
		credentials: true,
		maxAge: 86400,
		preflightContinue: false,
		optionsSuccessStatus: 204
	};
}
```

## 总结

通过统一CORS处理方式，移除冲突的中间件，并正确配置Fastify CORS插件，你的CORS问题应该得到解决。关键点是：

1. **只使用一种CORS处理方式**
2. **确保CORS插件在所有路由之前注册**
3. **正确配置预检请求处理**
4. **移除手动设置的CORS头**

如果问题仍然存在，请检查浏览器控制台的详细错误信息，这将帮助我们进一步诊断问题。
