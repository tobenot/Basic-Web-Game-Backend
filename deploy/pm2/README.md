# PM2 单机部署手册（已退役）

> **此路径已退役。** 生产环境统一使用 `deploy/systemd/`，不要安装或启动 PM2。

同一应用端口只能有一个 supervisor。旧机治理中 PM2 与 systemd 并存正是 `EADDRINUSE` 重启循环的根因；因此本目录的 setup/deploy 脚本现在 fail-closed，不会创建 PM2 daemon、写 PM2 startup 或执行 `pm2 start/reload/save`。

保留本目录只是为了让旧发布包和历史路径有明确的拒绝行为；新的部署入口见 `deploy/systemd/README.md`。

## 重部署检查清单（照着做就行）

> 2026-08-07 安全加固后。代码和文档已改好，这里只列**需要你在服务器上做的事**。

- [ ] **确认后端域名**：代码 / `.env.production` 默认 `https://bwb.tobenot.top`（`src/config.ts`），但**实际在跑的 Nginx server_name 可能与它不同**。以服务器上 Nginx 实际配置的域名为准，把 `Nginx/nginx.conf` 的 CORS map 那一行、以及 `/etc/bwb/bwb.env` 的 `BACKEND_PRODUCTION_URL` 统一成同一个域名。
- [ ] **Nginx CORS 白名单加游戏前端域名**：新游戏页面所在域名（如 `<游戏域名>`）逐条加进 `Nginx/nginx.conf` 的 `map $http_origin $allow_origin`，并确认 `sites-available` 里 `add_header Access-Control-Allow-Origin` 用了 `$allow_origin`。跨站 iframe（itch.io）游戏若带 cookie 需浏览器支持第三方 cookie + `ANON_COOKIE_SAMESITE=None`。
- [ ] **发布时跑迁移**：新增了 `QuotaUsage` / `SessionCredit` / `RedeemCode` 三张表，发布脚本设 `MIGRATE_ON_DEPLOY=1` 会自动 `prisma migrate deploy`。
- [ ] **填 `/etc/bwb/bwb.env`**（完整清单见下节）。重点：`JWT_SECRET` 用强随机值且≠`your-secret-key`；`HOST=127.0.0.1`（**不要 0.0.0.0**，否则 3000 端口直连绕过 IP 限流）；`CORS_PROVIDER=NGINX`；`AI_AUTH_REQUIRED=true` 只写一次。
- [ ] **把加固版 `Nginx/nginx.conf` 同步到服务器**，然后 `nginx -t && systemctl reload nginx`（CORS 精确源白名单、`server_tokens off`、TLS 1.2+）。
- [ ] **确认没有 PM2 owner**：旧机上 PM2 必须为 `masked/inactive`、进程数为 0；不要绕过 systemd 单 supervisor 约束。
- [ ] **服务器一次性准备**：按 `deploy/systemd/README.md` 创建无特权 `bwb` 用户、安装 unit，并准备 `/etc/bwb/bwb.env`。
- [ ] 本地打包 → 上传 → 发布：使用 systemd 发布脚本；不要调用本目录的 setup/deploy 脚本。
- [ ] 发布后检查 `systemctl status basic-web-game.service --no-pager`、`journalctl -u basic-web-game.service` 和 `/health`。

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

# 套件服务(匿名会话 + 每日额度 + 全局预算 + Turnstile)
DEFAULT_GAME_ID=wenming               # 缺省 game_id
ANON_COOKIE_SAMESITE=None             # 跨站 iframe 游戏(itch.io)需 None;同域部署可改 Lax
AI_DAILY_BUDGET_TOKENS=500000         # 全局每日 token 预算硬顶(所有游戏合计)
TURNSTILE_ENABLED=false               # 公测前按需开启
TURNSTILE_SECRET_KEY=...              # Cloudflare Turnstile 服务端密钥(开启时必填)

# 特性口令(可选,LLM 代理的前置门禁)
# ⚠ 开发期白名单,公测前必须移除:共享密钥放前端必被扒走,玩家额度走匿名会话 + Turnstile + 预算
FEATURE_PASSWORD_ENABLED=false
# FEATURE_PASSWORDS="pw-a:llm-all,admin-panel;pw-b:llm-gemini"

# 鉴权(每个变量只能出现一次,dotenv 重复键=后者覆盖前者)
AUTH_ENABLED=true
AI_AUTH_REQUIRED=true   # 曾因重复键被静默覆盖成 false,务必确认只有一份
TRPC_AUTH_REQUIRED=true

MIGRATE_ON_DEPLOY=1     # 如需发布时自动跑 Prisma 迁移
```

## 准备（服务器，一次性；systemd）

请严格按照 `deploy/systemd/README.md` 执行：创建无特权 `bwb` 用户，安装 `basic-web-game.service`，并把运行时变量放在 `/etc/bwb/bwb.env`（`root:bwb`, `0640`）。不要运行本目录的 PM2 setup。

## 发布

```bash
sudo bash deploy/systemd/deploy.sh /tmp/bwb-<version>.tar.gz
```

systemd 发布脚本会：
1. 解包到独立 release 目录；
2. 以 `bwb` 用户执行锁定的生产依赖安装和显式 Prisma client generation；
3. 原子切换 `current` 软链接；
4. 重启唯一的 systemd unit；
5. 检查 `http://127.0.0.1:PORT/health`，失败自动回滚；
6. 保留最近 5 个 release。

发布脚本会拒绝在线 PM2 进程，避免再次引入端口争用。

## 打包与上传

使用仓库提供的 systemd 发布包流程；发布包只能包含 `dist`、Prisma schema、package manifest/lockfile 和部署辅助脚本，不得包含 `.env`、`.env.publish` 或其他凭据文件。

## Nginx 要求（服务器，一次性）

`Nginx/nginx.conf` 已做安全加固，同步到服务器后 `nginx -t && systemctl reload nginx`：
- **CORS 精确源白名单**：不再用 `~*^https?://(.*\.)?tobenot\.top$` 正则放行整个子域（任意子域被控 = 凭据 CORS 源）。改成逐条精确 `origin`。
  按需增删条目，确保与后端实际使用的域名一致（见顶部检查清单第一项）。
- `server_tokens off` 已启用
- `ssl_protocols TLSv1.2 TLSv1.3`（已废弃的 TLSv1/1.1 移除）

## 运行与观测（systemd）

- 查看进程：`systemctl status basic-web-game.service --no-pager`
- 查看日志：`journalctl -u basic-web-game.service --since today --no-pager`
- 健康检查：`curl --fail http://127.0.0.1:3000/health`
- 确认唯一 owner：`ss -ltnp | grep ':3000'`，并确认 PM2 进程为 0。

## 回滚（systemd）

- 健康检查失败时，`deploy/systemd/deploy.sh` 自动恢复上一 release。
- 手动回滚前先确认目标 release、服务 unit 和端口 owner；不要通过 PM2 恢复。

## 安全注意事项

- 服务器上只放 `/etc/bwb/bwb.env` 私密变量，**不要把 env 文件打包进发布包**
- 不要用 `0.0.0.0` 绑 HOST，也不要对公网放行 3000 端口——`trustProxy` 只信任本机 Nginx，直连可绕过 IP 限流
- 应用名/服务名调整时，优先同步 `deploy/systemd/basic-web-game.service`、`deploy/systemd/deploy.sh`、`deploy/systemd/pre_deploy.sh` 和 `/etc/bwb/bwb.env`；不要重新启用 PM2。
- 数据库迁移推荐"扩展-收缩"策略，确保老版本也能运行新 schema
