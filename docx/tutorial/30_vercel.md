我怎么在提交到github的时候自动部署到vercel上面去？我准备测试生产环境数据库 


非常棒！这正是最激动人心的部分——让你的代码“活”起来，并建立一套自动化的工作流。将 GitHub 与 Vercel 连接，实现推送即部署 (CI/CD)，是现代 Web 开发的黄金标准。

下面是详细的步骤，我们将一步步完成这个配置。

### **准备工作：确保你的代码在 GitHub 上**

在连接 Vercel 之前，你的代码需要托管在 GitHub 的一个仓库 (Repository) 中。

这个相必大家都会。

-----

### **核心步骤：连接 Vercel 并实现自动部署**

#### **第1步：注册并连接 Vercel**

1.  前往 [Vercel.com](https://vercel.com/)。
2.  强烈建议**使用 GitHub 账号直接注册/登录**。这样可以最无缝地完成授权和连接。
3.  登录后，你会进入 Dashboard。点击 **Add New... -\> Project**。

#### **第2步：导入你的 GitHub 仓库**

1.  Vercel 会显示你的 GitHub 仓库列表。找到刚刚创建的 `my-ultimate-backend` 仓库，点击它旁边的 **Import** 按钮。
2.  Vercel 会让你选择一个 Scope (通常是你的个人账号)，确认即可。

#### **第3步：【最关键】配置 Vercel 项目**

导入后，Vercel 会让你配置项目。**这里的设置决定了部署能否成功。**

1.  **Framework Preset**: Vercel 通常能识别出是 Node.js 项目。如果它没有，请手动选择 **Other**。

2.  **Build and Output Settings**:

      * **Build Command**: 这里我们需要确保 Prisma Client 被正确生成。展开此项，输入以下命令：
        ```bash
        prisma generate && tsc
        ```
          * `prisma generate`：根据你的 `schema.prisma` 生成类型安全的 Prisma Client。
          * `tsc`：将你的 TypeScript 代码编译成 JavaScript，并输出到 `dist` 目录。
      * **Output Directory**: 保持默认的 `dist` 不变（与 `tsconfig.json` 中的 `outDir` 一致）。
      * **Install Command**: 保持 `npm install` 不变。

3.  **【核心】配置环境变量**
    这是为了让你部署的应用能连接到生产环境的 Supabase 数据库和 Resend 服务。点击 **Environment Variables** 展开。

    你需要把你 `.env` 文件里**所有**的变量都添加到这里。一个一个地添加：

      * `DATABASE_URL`: 粘贴你 **Supabase 的 PostgreSQL 连接字符串**。
      * `JWT_SECRET`: 粘贴你的 JWT 密钥。
      * `RESEND_API_KEY`: 粘贴你的 Resend API Key。
      * `PUBLIC_URL`: **这里不要再用 `localhost` 了！** 填入 Vercel 即将为你的应用生成的 URL。你可以在部署成功后再来修改，但可以先填一个占位符，例如 `https://your-repo-name.vercel.app`。

4.  **【核心】创建 `vercel.json` 配置文件**
    为了告诉 Vercel 如何处理你的 Fastify 服务器（它是一个单一的入口文件，而不是多个 Serverless 函数），你需要在项目的**根目录**下创建一个名为 `vercel.json` 的文件。

    ```json
    // vercel.json
    {
      "version": 2,
      "builds": [
        {
          "src": "dist/server.js",
          "use": "@vercel/node"
        }
      ],
      "rewrites": [
        { "source": "/(.*)", "destination": "/dist/server.js" }
      ]
    }
    ```

    **这段配置的含义是：**

      * `"builds"`: 告诉 Vercel，`dist/server.js` (编译后的主文件) 是一个 Node.js 服务。
      * `"rewrites"`: 告诉 Vercel，将所有进来的请求（例如 `/api/trpc/auth.requestLoginLink`）全部转发给这个 `dist/server.js` 文件来处理。

    **创建完这个文件后，记得将它也提交到 GitHub。**

    ```bash
    git add vercel.json
    git commit -m "Add Vercel configuration"
    git push
    ```

#### **第4步：部署！**

回到 Vercel 的配置页面，点击蓝色的 **Deploy** 按钮。

Vercel 会立即开始：

1.  从 GitHub 拉取你最新的代码。
2.  执行 `npm install` 安装依赖。
3.  执行 `prisma generate && tsc` 进行构建。
4.  根据 `vercel.json` 的配置，部署你的应用。

你可以在 Vercel 的界面上实时看到构建日志。如果出现任何红色错误，日志会告诉你问题出在哪里。

#### **第5步：验证与未来**

部署成功后，Vercel 会为你生成一个公开的 URL，例如 `my-ultimate-backend-liard.vercel.app`。

  * **测试生产环境**:
      * 使用 Postman 或其他 API 测试工具，向你的部署 URL 发送请求。例如，向 `https://<你的Vercel应用URL>/api/trpc/auth.requestLoginLink` 发送一个包含你邮箱的 `POST` 请求。
      * 检查你的邮箱是否收到了来自 `yourdomain.com` 的魔法链接。
      * 点击链接，看它是否能成功调用 `verifyMagicToken` 接口。
  * **调试**: 如果出现问题，可以去 Vercel 项目的 **Logs** 标签页查看实时的运行时日志。

**从现在开始，工作流已经完全自动化了。** 每当你向 GitHub 的 `main` 分支 `git push` 新的代码，Vercel 都会自动为你完成所有部署步骤。你只需要专注于写代码！

-----

### **在 Vercel 上使用你自己的域名**

将您自己的域名用于 Vercel 项目是一个非常简单且能极大提升专业度的操作。Vercel 会免费为您配置好 HTTPS (SSL证书)。

假设您的域名是 `yourdomain.com`，并且您希望您的 API 服务可以通过 `api.yourdomain.com` 访问。

#### **步骤 1: 在 Vercel 添加域名**

1.  登录 Vercel，进入您的项目主页。
2.  点击顶部导航栏的 **Settings** 标签。
3.  在左侧菜单中，选择 **Domains**。
4.  在输入框中，输入您想使用的域名。**最佳实践是为后端 API 使用一个子域名**，例如 `api.yourdomain.com`。输入后点击 **Add**。

#### **步骤 2: 配置 DNS 记录**

添加后，Vercel 会提示您域名“配置无效 (Invalid Configuration)”，并为您提供需要设置的 DNS 记录。通常有两种方式：

**方式 A (推荐，更简单): 使用 Vercel 的域名服务器 (Nameservers)**

  * **操作**: Vercel 会提供两个或更多的域名服务器地址（例如 `ns1.vercel-dns.com`）。您需要登录您的**域名注册商**（购买域名的地方，如 GoDaddy, Namecheap, Cloudflare 等）的网站，找到域名管理中的“域名服务器”或“Nameservers”设置，将原来的地址删除，换成 Vercel 提供的这几个。
  * **优点**: 设置一次后，Vercel 会自动为您管理所有必要的 DNS 记录，包括未来可能的变更。最省心。
  * **缺点**: 您域名的所有 DNS 解析都将由 Vercel接管。

**方式 B (手动，更灵活): 添加 CNAME 或 A 记录**

  * **操作**: 如果您不想更改域名服务器，可以选择只添加 Vercel 要求的那一条记录。对于子域名 `api.yourdomain.com`，Vercel 通常会要求您添加一个 `CNAME` 记录。
      * 登录您的**域名注册商**网站，进入 DNS 管理。
      * 添加一条新的记录：
          * **类型 (Type)**: `CNAME`
          * **主机/名称 (Host/Name)**: `api` (有些服务商可能要求填 `api.yourdomain.com`)
          * **值/指向 (Value/Points to)**: 填入 Vercel 提供给您的地址，通常是 `cname.vercel-dns.com`。
          * **TTL**: 保持默认即可。
  * **优点**: 您可以继续使用您原来的 DNS 服务商管理其他记录（例如邮箱的 MX 记录）。
  * **缺点**: 需要手动操作，但对于仅添加一个子域名来说也非常快。

#### **步骤 3: 等待与验证**

DNS 记录的修改在全球生效需要一些时间，这个过程称为“DNS 传播”，可能从几分钟到几小时不等。

您可以在 Vercel 的 Domains 设置页面刷新查看状态。一旦 Vercel 检测到您的 DNS 设置正确，状态就会变为绿色的 **Valid Configuration**。

此时，Vercel 会**自动为您的域名 `api.yourdomain.com` 签发并续订 SSL 证书**，您的 API 就可以通过 `https://api.yourdomain.com` 安全访问了。别忘了去 Vercel 的环境变量设置里，把 `PUBLIC_URL` 的值也更新为您自己的域名！
