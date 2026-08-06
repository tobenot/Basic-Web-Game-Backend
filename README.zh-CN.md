# Basic Web Game Backend（网页游戏后端）

**[English](README.md)** | **[简体中文](README.zh-CN.md)**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)](https://fastify.dev/)
[![tRPC](https://img.shields.io/badge/tRPC-11-2596BE?logo=trpc&logoColor=white)](https://trpc.io/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![npm](https://img.shields.io/npm/v/@tobenot/basic-web-game-backend-contract?logo=npm&label=contract)](https://www.npmjs.com/package/@tobenot/basic-web-game-backend-contract)
[![CI](https://github.com/tobenot/Basic-Web-Game-Backend/actions/workflows/publish-contract-npm.yml/badge.svg)](https://github.com/tobenot/Basic-Web-Game-Backend/actions/workflows/publish-contract-npm.yml)

[![GitHub stars](https://img.shields.io/github/stars/tobenot/Basic-Web-Game-Backend?style=social)](https://github.com/tobenot/Basic-Web-Game-Backend/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/tobenot/Basic-Web-Game-Backend?style=social)](https://github.com/tobenot/Basic-Web-Game-Backend/forks)
[![GitHub issues](https://img.shields.io/github/issues/tobenot/Basic-Web-Game-Backend?style=social)](https://github.com/tobenot/Basic-Web-Game-Backend/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/tobenot/Basic-Web-Game-Backend?style=social)](https://github.com/tobenot/Basic-Web-Game-Backend/pulls)

面向网页游戏的现代化、类型安全后端——登录认证、OpenAI 兼容的 LLM 代理、可发布为 npm 包的 TypeScript 接口契约，全部集成在一个 Fastify 服务中。

## 目录

- [✨ 功能特性](#-功能特性)
- [🛠 技术栈](#-技术栈)
- [🚀 快速开始](#-快速开始)
- [📖 API 参考](#-api-参考)
- [🗄 数据库结构](#-数据库结构)
- [📦 发布 API 契约](#-发布-api-契约)
- [🌐 部署](#-部署)
- [📁 项目结构](#-项目结构)
- [🤝 贡献](#-贡献)
- [📄 许可证](#-许可证)

## ✨ 功能特性

- 🔐 **免密码登录**——一封邮件同时携带魔法链接与一次性验证码（OTP）。令牌在数据库中均以 SHA-256 哈希存储，带有效期、一次性标记与 OTP 尝试次数限制。
- 🔑 **JWT 会话**——无状态会话，`amr` 声明记录登录方式（`magic_link` 或 `otp`）。
- 🤖 **OpenAI 兼容 LLM 代理**——`POST /v1/chat/completions`，支持多供应商路由（Gemini、DeepSeek、OpenAI、OpenRouter）、SSE 流式输出、推理内容与正文内容分离。
- 🛡 **功能密码（Feature Password）**——通过 `x-feature-password` 请求头，用共享密钥按供应商粒度开放 LLM 访问权限。
- 🧱 **端到端类型安全**——tRPC + Zod 输入校验，从前端到后端全程类型一致。
- 🗄 **Prisma ORM**——生产环境使用 PostgreSQL，本地开发使用 SQLite，带版本化迁移。
- 🌐 **灵活的 CORS**——开发/生产域名白名单（含 itch.io 等网页游戏平台），可用环境变量配置，或交由 NGINX 处理。
- 📦 **可发布的契约包**——将 `AppRouter` 类型作为 npm 包发布，前端类型永远与接口一致。
- ☁️ **部署就绪**——内置 Vercel 配置、Postgres Docker Compose、以及 Windows/Linux 打包脚本。

## 🛠 技术栈

| 层 | 技术 |
| --- | ---- |
| 运行时 | Node.js 22+ |
| 语言 | TypeScript |
| 框架 | Fastify 5 |
| API | tRPC 11 + Zod |
| 数据库 | Prisma 6（PostgreSQL / SQLite） |
| 认证 | JWT + 魔法链接 + OTP |
| 邮件 | Resend |
| AI 代理 | OpenAI 兼容（Gemini / DeepSeek / OpenAI / OpenRouter） |

## 🚀 快速开始

### 环境要求

- Node.js 22+（`.nvmrc` 固定为 `22`）
- npm
- 数据库：本地开发用 **SQLite**，生产环境用 **PostgreSQL**

### 安装与启动

```bash
# 1. 克隆仓库
git clone https://github.com/tobenot/Basic-Web-Game-Backend.git
cd Basic-Web-Game-Backend

# 2. 安装依赖
npm install

# 3. 配置环境变量
cp .env.example .env

# 4. 生成 Prisma schema 与客户端，并执行迁移
npm run migrate:dev

# 5. 启动开发服务器
npm run dev
```

服务器启动于 `http://localhost:3000`，测试页面为 `http://localhost:3000/test.html`。

### 环境变量

| 变量 | 说明 | 默认值 |
| ---- | ---- | ------ |
| `DATABASE_URL` | Prisma 连接串 | — |
| `AUTH_ENABLED` | 认证总开关 | `true` |
| `TRPC_AUTH_REQUIRED` | 受保护 tRPC 过程是否需要登录 | `true` |
| `AI_AUTH_REQUIRED` | LLM 代理是否需要登录 | `false` |
| `JWT_SECRET` | 会话 JWT 签名密钥 | — |
| `JWT_EXPIRY` | 会话有效期 | `7d` |
| `RESEND_API_KEY` | Resend 密钥，用于发送登录邮件 | — |
| `EMAIL_FROM` / `EMAIL_FROM_NAME` | 发件地址/名称 | — |
| `PORT` / `HOST` | 服务器监听地址 | `3000` / `localhost` |
| `FRONTEND_LOCAL_URL` | 本地前端地址（拼装魔法链接） | `http://localhost:5173` |
| `FRONTEND_PRODUCTION_URL` | 生产前端地址（拼装魔法链接） | — |
| `BACKEND_LOCAL_URL` / `BACKEND_PRODUCTION_URL` | 后端地址（用于链接与日志） | — |
| `CORS_ENABLED` | 是否启用 CORS 插件 | `true` |
| `CORS_ADDITIONAL_ORIGINS` | 逗号分隔的额外允许来源 | — |
| `CORS_PROVIDER` | 设为 `NGINX` 时由 NGINX 处理 CORS | — |
| `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` / `OPENROUTER_API_KEY` | 上游 LLM 密钥 | — |
| `FEATURE_PASSWORD_ENABLED` | 是否启用功能密码门禁 | `false` |
| `FEATURE_PASSWORDS` | `名称:作用域` 对，如 `admin-key:llm-all` | — |
| `AUTH_MAGIC_TTL_SEC` / `AUTH_OTP_TTL_SEC` | 魔法链接 / 验证码有效期 | `900` / `600` |
| `AUTH_OTP_LENGTH` / `AUTH_OTP_MAX_ATTEMPTS` | 验证码位数 / 最大尝试次数 | `6` / `5` |

## 📖 API 参考

所有接口都挂在 Fastify 服务下。tRPC 过程位于 `/api/trpc/<router>.<procedure>`。

### 健康检查

```
GET /health   → { "status": "ok" }
```

### 认证流程

1. **请求登录**——创建（或复用）用户，并在同一封邮件中发送魔法链接与 OTP。
2. **验证**——前端通过 `verifyMagicToken`（点击链接）或 `verifyEmailCode`（输入验证码）完成验证。
3. **携带凭证访问**——将返回的 JWT 放入请求头 `Authorization: Bearer <token>`。

| 过程 | 类型 | 输入 | 输出 |
| ---- | ---- | ---- | ---- |
| `auth.healthCheck` | query | — | `{ status, timestamp, message }` |
| `auth.requestLoginLink` | mutation | `{ email }` | `{ success, challengeId }` |
| `auth.verifyMagicToken` | query | `{ token }` | `{ sessionToken }` |
| `auth.verifyEmailCode` | mutation | `{ challengeId, code }` | `{ sessionToken }` |
| `user.getMe` | query · 🔒 | — | `{ id, email, createdAt }` |
| `announcement.getAnnouncement` | query | — | `{ announcement }` |

> 魔法链接基于前端地址（`FRONTEND_LOCAL_URL` / `FRONTEND_PRODUCTION_URL`）拼装；若该地址带 hash 路由，`token` 查询参数会被插入到 `#` 之前，方便 hash 路由读取。

### 示例：请求登录链接

```bash
curl -X POST 'http://localhost:3000/api/trpc/auth.requestLoginLink?batch=1' \
  -H 'Content-Type: application/json' \
  -d '{"0":{"json":{"email":"player@example.com"}}}'
```

### LLM 代理（OpenAI 兼容）

```
POST /v1/chat/completions
POST /api/v1/chat/completions
```

接受标准 OpenAI 请求体（`model`、`messages`、`stream`），并按模型前缀路由供应商：

| 前缀 | 供应商 | 所需环境变量 |
| ---- | ------ | ------------ |
| `gemini-*` | Google Gemini | `GEMINI_API_KEY` |
| `deepseek/*`、`deepseek-*` | DeepSeek | `DEEPSEEK_API_KEY` |
| `openai/*` | OpenAI | `OPENAI_API_KEY` |
| `openrouter/*` | OpenRouter | `OPENROUTER_API_KEY` |
| 其他 | 默认 OpenAI 兼容客户端 | — |

流式输出：

- 设置 `"stream": true` 即以 **SSE** 返回 OpenAI `chat.completion.chunk` 格式。
- 推理模型将 `delta.reasoning_content` 与 `delta.content` 分开返回。追加 `?reasoning_to_content=1` 可把推理内容合并进 `content`。
- 客户端断开即中止上游请求。

访问控制（按顺序检查）：

1. 若 `AI_AUTH_REQUIRED=true`，需要携带有效 JWT（`Authorization: Bearer …`）。
2. 若 `FEATURE_PASSWORD_ENABLED=true`，请求必须携带 `x-feature-password` 头，且其作用域覆盖所请求的供应商（如 `admin-key:llm-all`、`marketing-key:llm-gemini`）。

### 调试路由

`corsDebug.*` 与 `echo.*` 是开发时用来测试 CORS 与路由的小工具。

## 🗄 数据库结构

模型定义在 `prisma/schema.prisma.template`，由 `generate-prisma-schema` 脚本按环境的 `DATABASE_URL` 生成最终 `schema.prisma`。

| 模型 | 用途 |
| ---- | ---- |
| `User` | 玩家，以唯一 email 标识 |
| `LoginChallenge` | 一次邮件/登录尝试：哈希魔法令牌 + 哈希 OTP、有效期、尝试次数、已消费标记 |
| `AuthToken` | 旧版一次性令牌（向后兼容保留） |

## 📦 发布 API 契约

后端把 `AppRouter` 类型作为 npm 包发布给前端，保证两端接口永不漂移。

### 发布到 npm（公开）

运行 **Update Version** 工作流（选择 `patch` / `minor` / `major`），它会提升版本号、提交变更，并触发 **Publish API Contract to npm**：

```bash
npm view @tobenot/basic-web-game-backend-contract version
```

前端安装：

```bash
npm i @tobenot/basic-web-game-backend-contract
# 或：yarn add @tobenot/basic-web-game-backend-contract
```

### 本地手动发布（备用）

```bash
npm run build
npm version patch --no-git-tag-version
npm run publish   # npm publish --access public --registry=https://registry.npmjs.org
```

## 🌐 部署

- **Vercel**——`vercel.json` 已配置无服务器部署，`vercel-build` 脚本负责构建。
- **Nginx**——示例配置位于 [`Nginx/`](Nginx)（可设 `CORS_PROVIDER=NGINX` 让 NGINX 处理 CORS）。
- **Docker + PostgreSQL**——`docker compose -f docker-compose.postgres.yml up -d` 后使用 `:pg` 系列脚本（`migrate:pg:dev`、`studio:pg` 等）。
- **自托管打包**——`npm run pack:win` / `pack:linux` 可生成开箱即用的服务器包。

## 📁 项目结构

```
src/
├── app.ts                    # Fastify 服务 + tRPC 挂载 + CORS
├── server.ts                 # 入口
├── config.ts                 # 集中式环境变量配置
├── db.ts                     # Prisma 客户端
├── trpc.ts                   # tRPC 实例 + 受保护中间件
├── framework/
│   ├── routers/              # auth、user、announcement、llm-proxy、echo、cors-debug
│   ├── utils/                # llm-client、gemini-client、http-proxy、cors-test
│   └── templates/            # 邮件模板
├── middleware/               # auth、cors、feature-passwords
├── config/                   # auth / cors / feature-passwords 配置
└── ai/                       # AI 服务与请求队列
```

## 🤝 贡献

欢迎贡献！请先阅读：

- **[CONTRIBUTING.md](CONTRIBUTING.md)**——如何配置环境、切分支、测试与提交 PR。
- **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)**——社区行为准则。
- **[SECURITY.md](SECURITY.md)**——如何报告安全漏洞。

重大改动请先提交 issue 进行讨论；PR 请保持聚焦。已内置 [Bug 报告](.github/ISSUE_TEMPLATE/bug_report.yml) 与 [功能建议](.github/ISSUE_TEMPLATE/feature_request.yml) 模板。

## 📄 许可证

本项目基于 **MIT License** 分发，详见 [LICENSE](LICENSE)。

---

**由 [tobenot](https://github.com/tobenot) 用 ❤️ 制作**

*一个独立开源项目，为网页游戏后端提供扎实的基础。*
