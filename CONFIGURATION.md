# 🔧 项目配置说明

## 📋 环境变量配置

本项目使用统一的环境变量配置系统，所有URL和配置都通过环境变量管理。

### 🚀 快速开始

1. 复制环境变量示例文件：
```bash
cp .env.example .env
```

2. 根据你的环境修改 `.env` 文件中的配置

### 📝 配置项说明

#### 服务器配置
- `PORT`: 服务器端口（默认：3000）
- `HOST`: 服务器主机（默认：localhost）

#### 前端URL配置
- `FRONTEND_LOCAL_URL`: 本地开发前端URL（默认：http://localhost:5174）
- `FRONTEND_PRODUCTION_URL`: 生产环境前端URL（默认：https://tobenot.top/Basic-Web-Game/#/demo-with-backend）

#### 后端URL配置
- `BACKEND_LOCAL_URL`: 本地开发后端URL（默认：http://localhost:3000）
- `BACKEND_PRODUCTION_URL`: 生产环境后端URL（默认：https://api.tobenot.top）

**端口配置说明：**
- **云平台部署**（Vercel等）：通常不需要端口号，平台自动管理
- **自建服务器部署**：需要指定端口号，例如：
  - `http://服务器IP:8088` （HTTP协议）
  - `https://api.yourdomain.com:8443` （HTTPS非标准端口）
  - `https://api.yourdomain.com` （HTTPS标准端口443，可省略）

#### 邮件配置
- `EMAIL_FROM`: 邮件发送地址（默认：noreply@sendmail.tobenot.top）
- `EMAIL_FROM_NAME`: 邮件发件人显示名（默认：YourApp）

#### 登录与验证码配置
- `AUTH_DUAL_IN_ONE_EMAIL`: 是否在同一封邮件内同时包含魔法链接与验证码（默认：true）
- `AUTH_MAGIC_TTL_SEC`: 魔法链接有效期（秒）（默认：900）
- `AUTH_OTP_TTL_SEC`: 邮件验证码有效期（秒）（默认：600）
- `AUTH_OTP_LENGTH`: 邮件验证码长度（默认：6）
- `AUTH_OTP_MAX_ATTEMPTS`: 验证码最大尝试次数（默认：5）

#### 数据库配置
- `DATABASE_URL`: PostgreSQL数据库连接字符串

#### 安全配置
- `JWT_SECRET`: JWT签名密钥
- `RESEND_API_KEY`: Resend邮件服务API密钥

#### 环境配置
- `NODE_ENV`: 运行环境（development/production）

### 🔄 配置自动切换

系统会根据 `NODE_ENV` 环境变量自动切换配置：

- **开发环境** (`NODE_ENV=development`)：使用本地URL
- **生产环境** (`NODE_ENV=production`)：使用生产URL

### 🌐 CORS配置

CORS允许的源会根据环境自动配置：
- 开发环境：包含所有本地开发URL
- 生产环境：包含生产环境URL

### 📧 邮件链接

邮件中的魔法链接会根据当前环境自动生成正确的URL。
 - 使用前端URL（`FRONTEND_LOCAL_URL`/`FRONTEND_PRODUCTION_URL`）作为基准
 - 将 `token` 以查询参数形式追加到URL：`?token=...`
 - 若前端URL包含哈希路由（如 `.../#/path`），会在 `#` 之前插入查询参数（前端可直接读取）

### 🔍 前端API调用

前端会自动检测当前环境并调用正确的API地址：
- 本地开发：`http://localhost:3000/api/trpc`
- 生产环境：使用当前域名

## 🛠️ 部署配置

### 本地开发
```bash
# 使用默认配置启动
npm run dev

# 或指定环境变量
NODE_ENV=development npm run dev
```

### 生产部署
```bash
# 设置生产环境
NODE_ENV=production npm start
```

确保在生产环境中设置正确的环境变量：
- `NODE_ENV=production`
- `FRONTEND_PRODUCTION_URL`
- `BACKEND_PRODUCTION_URL`
- `EMAIL_FROM`

## 📊 配置迁移

### 从旧版本迁移

如果你之前使用的是硬编码的URL，现在可以通过环境变量来配置：

1. 创建 `.env` 文件
2. 复制 `.env.example` 中的配置
3. 根据你的环境修改相应的URL

### 兼容性

系统保持向后兼容，旧的 `PUBLIC_URL` 环境变量仍然可以使用。