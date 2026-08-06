# AI服务鉴权配置指南

## 环境变量配置

### 基础鉴权开关
```bash
# 全局鉴权开关 (默认: true)
AUTH_ENABLED=true

# AI服务鉴权开关 (默认: false)
AI_AUTH_REQUIRED=true

# tRPC路由鉴权开关 (默认: true)
TRPC_AUTH_REQUIRED=true

# JWT密钥 (必须设置)
JWT_SECRET=your-secret-key-here

# JWT过期时间 (默认: 7d)
JWT_EXPIRY=7d
```

### 邮件登录（魔法链接 + 邮件验证码）
```bash
# 是否在同一封邮件内同时包含魔法链接与验证码 (默认: true)
AUTH_DUAL_IN_ONE_EMAIL=true

# 魔法链接有效期（秒）（默认: 900 = 15分钟）
AUTH_MAGIC_TTL_SEC=900

# 邮件验证码有效期（秒）（默认: 600 = 10分钟）
AUTH_OTP_TTL_SEC=600

# 邮件验证码长度（默认: 6）
AUTH_OTP_LENGTH=6

# 邮件验证码最大尝试次数（默认: 5）
AUTH_OTP_MAX_ATTEMPTS=5
```

## 配置示例

### 1. 完全关闭鉴权 (开发环境)
```bash
AUTH_ENABLED=false
AI_AUTH_REQUIRED=false
TRPC_AUTH_REQUIRED=false
```

### 2. 只对AI服务启用鉴权
```bash
AUTH_ENABLED=true
AI_AUTH_REQUIRED=true
TRPC_AUTH_REQUIRED=false
```

### 3. 只对tRPC路由启用鉴权
```bash
AUTH_ENABLED=true
AI_AUTH_REQUIRED=false
TRPC_AUTH_REQUIRED=true
```

### 4. 完全启用鉴权 (生产环境)
```bash
AUTH_ENABLED=true
AI_AUTH_REQUIRED=true
TRPC_AUTH_REQUIRED=true
JWT_SECRET=your-production-secret-key
```

## 鉴权流程

### 1. 获取登录令牌
```bash
# 请求登录链接
curl -X POST http://localhost:3000/api/trpc/auth.requestLoginLink \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

# 验证魔法链接获取session token
curl -X POST http://localhost:3000/api/trpc/auth.verifyMagicToken \
  -H "Content-Type: application/json" \
  -d '{"token": "your-magic-token"}'
```

### 2. 使用AI服务 (需要鉴权时)
```bash
curl -X POST http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-session-token" \
  -d '{
    "model": "gpt-3.5-turbo",
    "messages": [{"role": "user", "content": "Hello"}]
  }'
```

### 3. 访问受保护的tRPC路由
```bash
curl -X GET http://localhost:3000/api/trpc/user.getMe \
  -H "Authorization: Bearer your-session-token"
```

## 注意事项

1. **JWT_SECRET**: 生产环境必须设置强密钥
2. **AI_AUTH_REQUIRED**: 控制 `/v1/chat/completions` 和 `/api/v1/chat/completions` 端点是否需要鉴权
3. **TRPC_AUTH_REQUIRED**: 控制 tRPC 路由是否需要鉴权
4. **AUTH_ENABLED**: 全局开关，关闭时所有鉴权都会被禁用

## 调试

启动服务器时会显示当前鉴权配置：
```
🔐 鉴权配置: {
  "enabled": true,
  "requireAuthForAI": true,
  "requireAuthForTRPC": true,
  "jwtSecret": "your-secret-key",
  "tokenExpiry": "7d"
}
```
