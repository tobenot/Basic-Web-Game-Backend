PM2 单机稳健部署（原子发布 + 健康检查 + 回滚）

这是一套最小却稳健的单机部署模板，适用于 Node.js（本项目 Fastify）。特性：
- 原子切换：每次发布一个版本目录，`current` 软链接切换
- 健康检查：失败自动回滚
- PM2 进程守护：开机自启、日志管理
- 可回滚：保留最近 5 个版本

目录与角色
- 服务器目录：`/opt/bwb/releases`, `/opt/bwb/current`, `/etc/bwb/bwb.env`, `/var/log/bwb`
- 运行用户：`bwb`
- 端口：默认 3000（可在 `/etc/bwb/bwb.env` 配置 `PORT`）

准备（服务器，一次性）
1) 以 root 运行：
```bash
sudo bash deploy/pm2/setup.sh
```
2) 按需编辑环境文件：
```bash
sudo nano /etc/bwb/bwb.env
# 至少确保：
# NODE_ENV=production
# PORT=3000
# HOST=0.0.0.0
# DATABASE_URL=...
# JWT_SECRET=...
# MIGRATE_ON_DEPLOY=1   # 如需在发布时自动执行 Prisma 迁移
```
3) 确保服务器已安装 Node.js（建议 LTS）与 npm。

打包（本地，每次）
```bash
bash deploy/pm2/pack.sh
# 生成：bwb-YYYYmmdd_HHMMSS.tar.gz
```

上传（本地 → 服务器）
```bash
scp bwb-*.tar.gz user@server:/tmp/
```

发布（服务器，每次）
```bash
sudo bash deploy/pm2/deploy.sh /tmp/bwb-YYYYmmdd_HHMMSS.tar.gz
```
脚本会：
- 解包到 `/opt/bwb/releases/<version>`
- 以 `bwb` 用户执行 `deploy/pre_deploy.sh`（安装生产依赖、可选迁移）
- 切换 `current` → 新版本
- `pm2 startOrReload ecosystem.config.js --env production`
- 检查 `http://127.0.0.1:PORT/health`，失败自动回滚
- 清理旧版本（保留 5 个）

运行与观测
- 查看进程：`sudo -u bwb pm2 ls`
- 查看日志：`sudo -u bwb pm2 logs --lines 200`
- 开机自启（已配置）：`pm2 startup ...` 与 `pm2 save`

回滚
- 脚本会在健康检查失败时自动回滚
- 如需手动回滚：
  - 找到上一版本目录：`ls -1dt /opt/bwb/releases/* | sed -n '1,2p'`
  - 手动切换：`sudo ln -sfn /opt/bwb/releases/<old> /opt/bwb/current && sudo -u bwb pm2 startOrReload /opt/bwb/current/ecosystem.config.js --env production && sudo -u bwb pm2 save`

自定义与注意
- 若要修改应用名，请同时改 `setup.sh`, `deploy.sh`, `pack.sh`, `ecosystem.config.js`, `bin/start.sh`, `pre_deploy.sh` 中的 `bwb`
- 数据库迁移：推荐“扩展-收缩”策略，确保老版本也能运行新 schema
- 安全：服务器上只放 `/etc/bwb/bwb.env` 私密变量，不要把 `.env` 打包进发布包