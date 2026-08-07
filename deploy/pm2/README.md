# PM2 单机部署手册（原子发布 + 健康检查 + 回滚）

一套最小却稳健的单机部署模板。特性：
- 原子切换：每次发布一个版本目录，`current` 软链接切换
- 健康检查：失败自动回滚
- PM2 进程守护：开机自启、日志管理
- 可回滚：保留最近 5 个版本

## 重部署检查清单（照着做就行）

> 2026-08-07 安全加固后。代码和文档已改好，这里只列**需要你在服务器上做的事**。

- [ ] **确认后端域名**：代码 / `.env.production` 默认 `https://bwb.tobenot.top`（`src/config.ts`），但**实际在跑的 Nginx server_name 可能与它不同**。以服务器上 Nginx 实际配置的域名为准，把 `Nginx/nginx.conf` 的 CORS map 那一行、以及 `/etc/bwb/bwb.env` 的 `BACKEND_PRODUCTION_URL` 统一成同一个域名。
- [ ] **填 `/etc/bwb/bwb.env`**（完整清单见下节）。重点：`JWT_SECRET` 用强随机值且≠`your-secret-key`；`HOST=127.0.0.1`（**不要 0.0.0.0**，否则 3000 端口直连绕过 IP 限流）；`CORS_PROVIDER=NGINX`；`AI_AUTH_REQUIRED=true` 只写一次。
- [ ] **把加固版 `Nginx/nginx.conf` 同步到服务器**，然后 `nginx -t && systemctl reload nginx`（CORS 精确源白名单、`server_tokens off`、TLS 1.2+）。
- [ ] 服务器一次性准备：`sudo bash deploy/pm2/setup.sh`。
- [ ] 本地打包 → 上传 → 发布：`bash deploy/pm2/pack.sh` → `scp bwb-*.tar.gz user@server:/tmp/` → `sudo bash deploy/pm2/deploy.sh /tmp/bwb-*.tar.gz`。
- [ ] 发布后 `sudo -u bwb pm2 logs --lines 50`，确认启动日志是 `"jwtSecret": "[REDACTED]"` 而不是明文。

## 环境变量：唯一来源是 `/etc/bwb/bwb.env`

> **重要（2026-08 安全加固后）**
> 运行时环境**只从 `/etc/bwb/bwb.env` 加载**（`bin/start` 启动时 `source` 它）。
> `ecosystem.config.js` 已移除 `DOTENV_CONFIG_PATH: './.env.publish'` —— 因为打包里根本没有 `.env.publish`，那行配置以前是空转的。
> 本地仓库里的 `.env.publish` / `.env.production` 只用于本地 `migrate:prod` 等脚本，**不是运行时配置**。

- 服务器目录：`/opt/bwb/releases`, `/opt/bwb/current`, `/etc/bwb/bwb.env`, `/var/log/bwb`
- 运行用户：`bwb`
- 端口：默认 3000（在 `/etc/bwb/bwb.env` 配置 `PORT`）

### 必填环境变量清单

```bash
# /etc/bwb/bwb.env 最小必须集
NODE_ENV=production
PORT=3000
HOST=127.0.0.1          # 只绑本机回环,不要 0.0.0.0 —— 避免绕过 Nginx 直连应用
CORS_PROVIDER=NGINX     # 告知应用 CORS 由 Nginx 处理,应用内 CORS 关闭

DATABASE_URL=postgresql://user:pass@host:5432/db
JWT_SECRET=<强随机值,且不能等于 your-secret-key>   # 缺失或等于默认值 → 拒绝启动
RESEND_API_KEY=...

# AI 密钥按需: OPENAI_API_KEY / DEEPSEEK_API_KEY / OPENROUTER_API_KEY / GEMINI_API_KEY

# 特性口令(可选,LLM 代理的前置门禁)
FEATURE_PASSWORD_ENABLED=true
FEATURE_PASSWORDS="pw-a:llm-all,admin-panel;pw-b:llm-gemini"

# 鉴权(每个变量只能出现一次,dotenv 重复键=后者覆盖前者)
AUTH_ENABLED=true
AI_AUTH_REQUIRED=true   # 曾因重复键被静默覆盖成 false,务必确认只有一份
TRPC_AUTH_REQUIRED=true

MIGRATE_ON_DEPLOY=1     # 如需发布时自动跑 Prisma 迁移
```

## 准备（服务器，一次性）

```bash
sudo bash deploy/pm2/setup.sh
sudo nano /etc/bwb/bwb.env     # 填上面清单
```

确保服务器已安装 Node.js（建议 LTS）与 npm。

## 打包（本地，每次）

```bash
bash deploy/pm2/pack.sh        # 生成 bwb-YYYYmmdd_HHMMSS.tar.gz
```

## 上传（本地 → 服务器）

```bash
scp bwb-*.tar.gz user@server:/tmp/
```

## 发布（服务器，每次）

```bash
sudo bash deploy/pm2/deploy.sh /tmp/bwb-YYYYmmdd_HHMMSS.tar.gz
```

脚本会：
1. 解包到 `/opt/bwb/releases/<version>`
2. 以 `bwb` 用户执行 `deploy/pre_deploy.sh`（source env、装生产依赖、可选迁移）
3. 切换 `current` → 新版本
4. `pm2 startOrReload ecosystem.config.js --env production`（经 `bin/start` 启动,读 `/etc/bwb/bwb.env`）
5. 检查 `http://127.0.0.1:PORT/health`，失败自动回滚
6. 清理旧版本（保留 5 个）

## Nginx 要求（服务器，一次性）

`Nginx/nginx.conf` 已做安全加固，同步到服务器后 `nginx -t && systemctl reload nginx`：
- **CORS 精确源白名单**：不再用 `~*^https?://(.*\.)?tobenot\.top$` 正则放行整个子域（任意子域被控 = 凭据 CORS 源）。改成逐条精确 `origin`。
  按需增删条目，确保与后端实际使用的域名一致（见顶部检查清单第一项）。
- `server_tokens off` 已启用
- `ssl_protocols TLSv1.2 TLSv1.3`（已废弃的 TLSv1/1.1 移除）

## 运行与观测

- 查看进程：`sudo -u bwb pm2 ls`
- 查看日志：`sudo -u bwb pm2 logs --lines 200`
- 开机自启（已配置）：`pm2 startup ...` 与 `pm2 save`

## 回滚

- 脚本会在健康检查失败时自动回滚
- 手动回滚：
  `sudo ln -sfn /opt/bwb/releases/<old> /opt/bwb/current && sudo -u bwb pm2 startOrReload /opt/bwb/current/ecosystem.config.js --env production && sudo -u bwb pm2 save`

## 安全注意事项

- 服务器上只放 `/etc/bwb/bwb.env` 私密变量，**不要把 env 文件打包进发布包**
- 不要用 `0.0.0.0` 绑 HOST，也不要对公网放行 3000 端口——`trustProxy` 只信任本机 Nginx，直连可绕过 IP 限流
- 改应用名需同时改 `setup.sh`、`deploy.sh`、`pack.sh`、`ecosystem.config.js`、`bin/start.sh`、`pre_deploy.sh` 里的 `bwb`
- 数据库迁移推荐"扩展-收缩"策略，确保老版本也能运行新 schema
