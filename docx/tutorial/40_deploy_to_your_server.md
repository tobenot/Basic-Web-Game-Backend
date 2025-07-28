
-----

### **部署到你自己的服务器 (Self-Hosting)**

这是一个完全不同的领域，您将从“平台即服务”的用户转变为“系统管理员”。这给予您**完全的控制权**，但也意味着**更大的责任**。

假设您已经有了一台云服务器（例如来自 DigitalOcean, AWS EC2, Linode, 阿里云等的 VPS），并且可以通过 SSH 连接上去。

#### **阶段 1：服务器环境准备**

1.  **安装 Node.js**: 推荐使用 `nvm` (Node Version Manager) 来安装，这样可以轻松切换 Node.js 版本。
    ```bash
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    # 重启终端或运行 source ~/.bashrc
    nvm install --lts # 安装最新的长期支持版 Node.js
    ```
2.  **安装 Git**:
    ```bash
    sudo apt update
    sudo apt install git -y
    ```
3.  **安装 PM2**: 这是 Node.js 的进程管理器，能让您的应用在后台持续运行，并在崩溃时自动重启。
    ```bash
    npm install pm2 -g
    ```
4.  **安装 Nginx**: 这是一个高性能的 Web 服务器，我们将用它作为“反向代理”，将来自公网的请求转发给在内部端口运行的 Node.js 应用。
    ```bash
    sudo apt install nginx -y
    ```

#### **阶段 2：部署你的应用**

1.  **拉取代码**: 在服务器上，进入您想存放项目的目录（例如 `/var/www`），然后从 GitHub 克隆您的项目。
    ```bash
    cd /var/www
    git clone https://github.com/your-username/your-repo-name.git
    cd your-repo-name
    ```
2.  **安装依赖**:
    ```bash
    npm install
    ```
3.  **创建 `.env` 文件**: **这一步至关重要**。`.env` 文件不在 Git 的版本控制中，所以您必须在服务器上手动创建它，并填入您**生产环境**的所有密钥。
    ```bash
    nano .env
    # 将你的生产环境变量（Supabase URL, JWT Secret等）粘贴进去，然后保存退出
    ```
4.  **构建应用**:
      * 首先，**针对生产数据库运行迁移**。`migrate deploy` 命令不会检查数据库与 schema 的差异，只会应用所有尚未应用的迁移，更安全。
        ```bash
        npx prisma migrate deploy
        ```
      * 然后，生成 Prisma Client 并编译代码。
        ```bash
        npm run build 
        # (假设你的 package.json 中有 "build": "prisma generate && tsc")
        ```

#### **阶段 3：运行与进程管理**

1.  **使用 PM2 启动应用**:
    ```bash
    # 启动应用，并给它取个名字叫 "my-api"
    pm2 start dist/server.js --name my-api
    ```
2.  **设置开机自启**: 生成并执行一个命令，让 PM2 在服务器重启后能自动恢复您的应用。
    ```bash
    pm2 startup
    # (它会生成一行命令，复制并执行它)
    pm2 save
    ```
3.  **查看日志**: 您可以使用 `pm2 logs my-api` 来查看应用的实时日志。

#### **阶段 4：配置 Nginx 反向代理与域名**

1.  **配置 Nginx**:

      * 创建一个新的 Nginx 配置文件：
        ```bash
        sudo nano /etc/nginx/sites-available/api.yourdomain.com
        ```
      * 将以下内容粘贴进去，并保存。它告诉 Nginx 将所有到 `api.yourdomain.com` 的请求都转发给本地 3000 端口（您的 Node.js 应用正在监听的端口）。
        ```nginx
        server {
            listen 80;
            server_name api.yourdomain.com;

            location / {
                proxy_pass http://localhost:3000;
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade;
                proxy_set_header Connection 'upgrade';
                proxy_set_header Host $host;
                proxy_cache_bypass $http_upgrade;
            }
        }
        ```
      * 启用这个配置：
        ```bash
        sudo ln -s /etc/nginx/sites-available/api.yourdomain.com /etc/nginx/sites-enabled/
        sudo nginx -t # 测试配置是否正确
        sudo systemctl restart nginx # 重启 Nginx
        ```

2.  **配置域名 DNS**:

      * 登录您的域名注册商，添加一条 `A` 记录。
          * **类型**: `A`
          * **主机/名称**: `api`
          * **值**: 您服务器的公网 IP 地址。

3.  **配置 HTTPS (SSL)**:

      * 使用 Certbot 和 Let's Encrypt 可以免费、自动地完成。

    <!-- end list -->

    ```bash
    sudo apt install certbot python3-certbot-nginx -y
    sudo certbot --nginx -d api.yourdomain.com
    ```

      * Certbot 会自动修改您的 Nginx 配置以启用 HTTPS，并设置定时任务来自动续订证书。

完成以上所有步骤后，您的应用就成功地部署在您自己的服务器上，并通过您自己的域名提供安全的 HTTPS 服务了。后续更新代码时，您需要 SSH 到服务器，`git pull`，然后 `pm2 restart my-api`。