# 43. 环境变量配置：.env.publish 详解

## 为什么需要 .env.publish？

在生产环境中，我们**绝对不能**使用开发环境的 `.env` 文件，因为：

1. **安全性**：生产环境需要真实的 API 密钥、数据库连接字符串等敏感信息
2. **配置差异**：生产环境的端口、主机、数据库等配置与开发环境完全不同
3. **环境隔离**：避免开发环境的测试配置影响生产服务

## .env.publish 文件结构

在项目根目录创建 `.env.publish` 文件：

```env
# 基础配置
NODE_ENV=production
HOST=0.0.0.0
PORT=8088

# 安全配置
JWT_SECRET=your-super-secret-jwt-key-here
RESEND_API_KEY=your-resend-api-key-here

# 数据库配置（选择其一）
# SQLite（推荐用于简单部署）
DATABASE_URL=file:./data/prod.db

# PostgreSQL（推荐用于生产环境）
# DATABASE_URL=postgresql://username:password@localhost:5432/dbname?schema=public

# 部署配置
MIGRATE_ON_DEPLOY=1

# CORS 配置（如有前端域名）
# CORS_ADDITIONAL_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# HTTP 代理配置（如需要）
# HTTP_PROXY=http://proxy-server:port
# HTTPS_PROXY=http://proxy-server:port
```

## 部署时的环境变量加载

### PM2 部署

我们已修改 `deploy/pm2/ecosystem.config.js` 确保 PM2 能正确加载 `.env.publish`：

```javascript
module.exports = {
  apps: [{
    name: 'your-app-name',
    script: 'dist/server.js',
    node_args: '-r dotenv/config',  // 预加载 dotenv
    env: {
      NODE_ENV: 'production',
      DOTENV_CONFIG_PATH: './.env.publish',  // 指定环境变量文件
    },
    // ... 其他配置
  }]
};
```

### 一键部署包

使用项目内置的一键部署包时，部署脚本会自动检测并使用 `.env.publish`：

1. **Windows**: 双击 `deploy.bat`
2. **Linux**: 执行 `bash deploy.sh`

部署脚本会：
- 检查 `.env.publish` 是否存在
- 加载所有环境变量
- 启动应用服务

## 环境变量优先级

系统按以下优先级加载环境变量：

1. **系统环境变量**（最高优先级）
2. **PM2 配置中的 env 字段**
3. **`.env.publish` 文件**
4. **`.env` 文件**（如果存在且 `.env.publish` 不存在）
5. **默认值**（最低优先级）

## 验证环境变量加载

启动应用后，检查控制台输出确认环境变量已正确加载：

```
🔍 环境变量检查:
  - NODE_ENV: production
  - PORT: 8088
  - HOST: 0.0.0.0
  - JWT_SECRET: 已设置
  - RESEND_API_KEY: 已设置
```

## 常见问题

### Q: 修改 .env.publish 后需要重启吗？
**A: 是的！** 修改环境变量文件后，必须重启 PM2 进程：
```bash
pm2 restart your-app-name
# 或
pm2 reload ecosystem.config.js
```

### Q: 为什么我的环境变量没有生效？
**A: 检查以下几点：**
1. 文件路径是否正确（项目根目录）
2. 文件格式是否正确（UTF-8，无 BOM）
3. 变量名是否正确（全大写，下划线分隔）
4. 是否重启了应用

### Q: 可以在 .env.publish 中使用注释吗？
**A: 可以！** 使用 `#` 开头添加注释：
```env
# 这是注释
PORT=8088  # 行内注释也可以
```

## 安全提醒

1. **永远不要**将 `.env.publish` 提交到 Git
2. **定期更换**敏感信息（JWT_SECRET、API 密钥等）
3. **限制文件权限**：`chmod 600 .env.publish`
4. **备份配置**：将配置模板保存在安全的地方

## 下一步

配置好 `.env.publish` 后，继续阅读：
- [40. 部署到你的服务器](./40_deploy_to_your_server.md)
- [41. SSL 证书配置](./41_ssl_certificates.md)
- [42. Nginx 配置](./42_nginx_config.md)
