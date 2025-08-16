### **最终的数据库工作流程 (小白指南)**

下面是你的日常工作流程（本地与线上统一使用 Postgres，避免与 SQLite 的方言/语义差异导致的坑）。

#### 开始前：安装与环境准备（Windows）

- 必装：Docker Desktop（含 Compose v2）、Node.js 18（含 npm）、Git

- 一键安装（PowerShell 管理员）
```powershell
winget install -e --id Docker.DockerDesktop
winget install -e --id OpenJS.NodeJS.LTS
winget install -e --id Git.Git
```

- 验证
```powershell
docker --version
docker compose version
node -v
npm -v
```

- 首次安装 Docker 后（如提示未启用 WSL2）
```powershell
wsl --status
wsl --install
```
重启系统

#### **场景1：日常本地开发 (写代码、测试功能)**

1.  **启动本地 Postgres（Docker）**：
    ```bash
    docker compose -f docker-compose.postgres.yml up -d
    ```

2.  **配置 `.env` 使用本地 Postgres**：
    将 `DATABASE_URL` 设置为：
    ```env
    DATABASE_URL="postgres://dev:dev@localhost:5432/app?sslmode=disable"
    ```
    注意：不要再使用 `file:`（SQLite）前缀。

3.  **首次从 SQLite 切换到 Postgres 时（只需一次）**：
    - 删除旧的 SQLite 迁移（因为其方言不兼容）：直接删除整个 `prisma/migrations` 目录。
    - 重新生成 schema、客户端并初始化迁移：
      ```bash
      npm run prisma:generate:schema
      npx prisma generate
      npx prisma migrate dev --name init
      ```

4.  **日常启动开发服务器**：
    ```bash
    npm run dev
    ```
    这会读取 `.env`，使用本地 Postgres 连接。

5.  **当你修改了 `schema.prisma`**（例如新增字段）：
    - 创建迁移并应用到本地数据库：
      ```bash
      npm run migrate:dev
      ```

6.  **查看/编辑本地数据**：
    ```bash
    npm run studio
    ```

> 可选：已提供一组以 Postgres 为前提的便捷脚本（例如 `db:up`、`migrate:pg:reinit`、`dev:pg`、`studio:pg`）。考虑到 Windows 环境兼容性，推荐按上述通用步骤操作；熟悉者可使用这些快捷脚本。

#### Docker 常见问题（Windows）

- 运行 `docker compose ...` 报错 `unable to get image ... open //./pipe/docker_engine`：Docker 守护进程未启动。
  - 启动 Docker Desktop，等待托盘图标就绪后重试
  - 若仍不行（需要一次性管理员操作）：
    ```powershell
    Start-Service com.docker.service
    net localgroup docker-users %USERNAME% /add
    ```
    注销或重启后再试：
    ```powershell
    docker version
    docker info
    ```
- 需不需要管理员权限？不需要。只有当首次配置本机服务权限或加入 `docker-users` 组时使用管理员 PowerShell。

#### **场景2：将数据库改动部署到线上 (Supabase)**

**这是最关键的步骤，请仔细阅读。**

假设你已经在本地通过 `npm run migrate:dev` 创建了一个新的迁移（比如 `20250729..._add-user-name`），现在要把该迁移应用到 Supabase。

1.  **确保你的 `.env.publish` 文件配置正确**，`DATABASE_URL` 指向你的 Supabase 数据库。

2.  **运行部署命令**：
    ```bash
    npm run migrate:prod
    ```
    *   这个命令会加载 `.env.publish` 的配置，连接到 **Supabase**。
    *   它会执行 `prisma migrate deploy`，检查 `prisma/migrations`，只运行未在线上执行过的迁移。
    *   **它不会重置你的线上数据库。**

3.  **完成！** 你的线上数据库已经与本地结构保持一致。

通过这套流程，我们实现了：
*   本地与线上同为 Postgres，避免语义/方言漂移。
*   本地开发高效，线上部署安全且可审计。
*   环境配置清晰分离。

---

#### 常见问题 (FAQ)

- **报错：`The current Prisma migrate lock file was created with provider sqlite`**
  - 说明你本地的 `prisma/migrations/migration_lock.toml` 仍是 SQLite 记录。
  - 解决：删除整个 `prisma/migrations` 目录；确认 `.env` 的 `DATABASE_URL` 为 Postgres；依次执行：
    ```bash
    npm run prisma:generate:schema
    npx prisma generate
    npx prisma migrate dev --name init
    ```

- **为什么不建议本地用 SQLite？**
  - 迁移不兼容：SQLite 生成的迁移无法直接用于 Postgres（Supabase）。
  - 语义差异：如 `uuid/jsonb/数组/时区时间/约束/索引` 等特性在 SQLite 不等价。
  - 工具链耦合：本项目会根据 `DATABASE_URL` 切换 provider，本地用 `file:` 会放大上述问题。