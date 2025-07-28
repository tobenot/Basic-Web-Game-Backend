### **最终的数据库工作流程 (小白指南)**

下面是你的日常工作流程：

#### **场景1：日常本地开发 (写代码、测试功能)**

1.  **启动开发服务器**：
    ```bash
    npm run dev
    ```
    这个命令会加载 `.env` 文件的配置，使用本地的 `dev.db`。你可以随意增删改查，不会影响任何人。

2.  **修改了 `schema.prisma`** (例如，给 `User` 模型增加了一个 `name` 字段)：
    *   你需要为这个改动创建一个新的迁移。运行：
        ```bash
        npm run migrate:dev
        ```
    *   Prisma 会让你给这次迁移起个名字 (比如 `add-user-name`)。
    *   它会更新你的 `dev.db`，并在 `prisma/migrations` 文件夹里创建一个新的 SQL 迁移文件。

3.  **查看本地数据库内容**:
    ```bash
    npm run studio
    ```
    这会打开一个网页，让你能像操作 Excel 一样查看和编辑本地的 `dev.db` 数据。

#### **场景2：将数据库改动部署到线上 (Supabase)**

**这是最关键的步骤，请仔细阅读。**

假设你已经在本地开发完成了一个新功能，并通过 `npm run migrate:dev` 创建了一个新的迁移文件（比如 `20250729..._add-user-name`）。现在你要把这个 `User` 表的新增 `name` 字段同步到线上的 Supabase 数据库。

1.  **确保你的 `.env.development` 文件配置正确**，`DATABASE_URL` 指向你的 Supabase 数据库。

2.  **运行部署命令**：
    ```bash
    npm run migrate:prod
    ```
    *   这个命令会加载 `.env.development` 的配置，连接到 **Supabase**。
    *   它会执行 `prisma migrate deploy`，这个安全的命令会检查 `migrations` 文件夹，发现 `20250729..._add-user-name` 这个迁移还没有在线上数据库执行过，于是就只运行这一个迁移。
    *   **它绝不会重置你的线上数据库。**

3.  **完成！** 你的线上数据库现在已经和你本地的数据库结构保持一致了。

通过这套流程，我们实现了：
*   本地开发的自由和速度。
*   线上部署的严谨和安全。
*   清晰分离的环境配置。