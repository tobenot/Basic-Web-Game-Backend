# 🔧 CORS配置指南

## 概述

我们实现了一个更强大、更灵活的CORS解决方案，相比之前的简单配置，新方案提供了：

- ✅ **集中管理**: 所有CORS逻辑都在专门的中间件中处理
- ✅ **环境感知**: 根据环境自动调整CORS策略
- ✅ **详细日志**: 完整的CORS请求日志和调试信息
- ✅ **灵活配置**: 通过环境变量轻松配置
- ✅ **测试工具**: 内置的CORS测试和调试工具

## 🏗️ 架构设计

### 文件结构
```
src/
├── config/
│   └── cors.ts          # CORS配置管理
├── middleware/
│   ├── cors.ts          # CORS中间件实现
│   └── index.ts         # 中间件导出
├── routers/
│   └── cors-debug.ts    # CORS调试API
├── utils/
│   └── cors-test.ts     # CORS测试工具
└── server.ts            # 主服务器文件
```

### 核心组件

1. **CORS配置管理器** (`src/config/cors.ts`)
   - 集中管理所有CORS相关配置
   - 支持环境变量覆盖
   - 提供类型安全的配置接口

2. **CORS中间件** (`src/middleware/cors.ts`)
   - 处理预检请求 (OPTIONS)
   - 验证源白名单
   - 设置正确的CORS响应头

3. **调试工具** (`src/utils/cors-test.ts`)
   - 命令行CORS测试
   - 配置验证
   - 常见源测试

4. **调试API** (`src/routers/cors-debug.ts`)
   - RESTful API端点
   - 实时CORS配置查询
   - 源验证测试

## ⚙️ 配置选项

### 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `CORS_ENABLED` | `true` | 是否启用CORS中间件 |
| `CORS_MAX_AGE` | `86400` | 预检请求缓存时间（秒） |
| `CORS_ADDITIONAL_ORIGINS` | - | 额外的允许源（逗号分隔） |

### 配置示例

```bash
# .env
CORS_ENABLED=true
CORS_MAX_AGE=86400
CORS_ADDITIONAL_ORIGINS=https://myapp.com,https://admin.myapp.com
```

## 🧪 测试和调试

### 1. 命令行测试

启动服务器时，会自动运行CORS配置测试：

```bash
npm run dev
```

输出示例：
```
🔧 CORS配置详情:
==================================================
启用状态: ✅ 启用
环境: development
最大缓存时间: 86400秒
允许的方法: GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS
允许的头部: Content-Type, Authorization, x-trpc-source, X-Requested-With, Accept, Origin
支持凭据: 是
允许的源:
  1. http://localhost:5174
  2. http://localhost:3000
  3. https://tobenot.top/Basic-Web-Game/#/demo-with-backend
  4. https://bwb.tobenot.top
==================================================
```

### 2. 浏览器测试

访问 `http://localhost:3000/cors-test.html` 使用可视化测试工具。

### 3. API测试

使用tRPC客户端测试：

```typescript
// 获取CORS配置
const config = await trpc.corsDebug.getConfig.query();

// 测试特定源
const result = await trpc.corsDebug.testOrigin.query({
  origin: 'http://localhost:3000'
});

// 健康检查
const health = await trpc.corsDebug.health.query();
```

## 🔍 常见问题解决

### 1. CORS错误排查

如果遇到CORS错误，请检查：

1. **源是否在白名单中**
   ```bash
   # 查看当前允许的源
   curl http://localhost:3000/api/trpc/corsDebug.getConfig
   ```

2. **环境变量是否正确**
   ```bash
   # 检查环境变量
   echo $CORS_ENABLED
   echo $CORS_ADDITIONAL_ORIGINS
   ```

3. **服务器日志**
   ```bash
   # 查看CORS相关日志
   npm run dev | grep "CORS"
   ```

### 2. 添加新的允许源

方法1：通过环境变量
```bash
export CORS_ADDITIONAL_ORIGINS="https://newdomain.com,https://app.newdomain.com"
```

方法2：修改配置文件
```typescript
// src/config/cors.ts
const baseOrigins = [
  // ... 现有源
  'https://newdomain.com',
  'https://app.newdomain.com',
];
```

### 3. 禁用CORS（不推荐）

```bash
export CORS_ENABLED=false
```

## 🚀 性能优化

### 1. 预检请求缓存

设置合适的 `CORS_MAX_AGE` 值：
- 开发环境：`3600`（1小时）
- 生产环境：`86400`（24小时）

### 2. 源白名单优化

- 生产环境只允许HTTPS源
- 定期清理不再使用的源
- 使用通配符时要谨慎

## 🔒 安全考虑

### 1. 源验证

- 严格验证Origin头
- 不允许通配符 `*`
- 生产环境只允许HTTPS

### 2. 凭据处理

- 设置 `credentials: true` 时要特别小心
- 确保源白名单是可信的
- 考虑使用 `SameSite` cookie属性

### 3. 头部限制

只允许必要的头部：
```typescript
allowedHeaders: [
  'Content-Type', 
  'Authorization', 
  'x-trpc-source'
]
```

## 📊 监控和日志

### 1. 日志格式

```
🔍 CORS检查 - Origin: http://localhost:3000
🔍 允许的源: ['http://localhost:3000', 'https://tobenot.top']
🔍 源是否允许: true
```

### 2. 错误日志

```
❌ CORS拒绝 - Origin: https://malicious-site.com
🔍 处理OPTIONS预检请求
❌ 源不在白名单中，拒绝请求
```

## 🔄 迁移指南

### 从旧配置迁移

1. **备份当前配置**
   ```bash
   cp .env .env.backup
   ```

2. **更新环境变量**
   ```bash
   # 添加新的CORS配置
   echo "CORS_ENABLED=true" >> .env
   echo "CORS_MAX_AGE=86400" >> .env
   ```

3. **测试新配置**
   ```bash
   npm run dev
   # 访问 http://localhost:3000/cors-test.html
   ```

4. **验证功能**
   - 测试所有前端应用
   - 检查API调用是否正常
   - 验证预检请求

## 📚 参考资源

- [MDN CORS文档](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Fastify CORS插件](https://github.com/fastify/fastify-cors)
- [tRPC CORS最佳实践](https://trpc.io/docs/server/cors)

## 🤝 贡献

如果你发现CORS相关的问题或有改进建议，请：

1. 使用测试工具复现问题
2. 查看服务器日志
3. 提交详细的错误报告
4. 包含环境信息和配置

---

**注意**: 这个CORS解决方案专门为Fastify + tRPC架构设计，如果你使用其他框架，可能需要相应调整。