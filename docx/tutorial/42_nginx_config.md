

# Nginx作为Node.js应用反向代理的配置指南

## 简介

本指南旨在为Node.js应用提供一个生产级别的Nginx反向代理配置方案。Nginx作为前端接入层，负责处理来自客户端的HTTP/S请求，并将其转发给在本地运行的Node.js应用。

**使用Nginx的好处：**

  - **SSL/TLS加密**：轻松配置HTTPS，保护数据传输安全。
  - **负载均衡与性能**：处理静态资源、Gzip压缩，减轻Node.js应用的压力。
  - **安全加固**：作为应用防火墙，抵御常见的Web攻击。
  - **CORS管理**：集中、可靠地处理跨域资源共享策略。
  - **无缝部署**：可以在不中断服务的情况下更新后端应用。

## 核心概念

1.  **`nginx.conf` 与 `sites-available`**

      * `/etc/nginx/nginx.conf`：Nginx的**主配置文件**，定义了全局的、底层的设置，如工作进程数、日志位置以及最重要的 `http` 区块。
      * `/etc/nginx/sites-available/`：存放**所有网站**的独立配置文件。每个文件代表一个 `server` 区块，即一个网站或应用。
      * `/etc/nginx/sites-enabled/`：通过创建从 `sites-available` 到这里的**软链接 (symbolic link)** 来“启用”一个网站。

2.  **`http`, `server`, `location` 区块**

      * `http { ... }`：所有网络相关配置的“总纲”，定义在 `nginx.conf` 中。
      * `server { ... }`：定义一个具体的网站，根据 `server_name` (域名) 来区分。
      * `location { ... }`：在 `server` 区块内部，根据URL路径 (`/`, `/api`, 等) 来匹配请求并应用不同的处理规则。

3.  **`map` vs. `if` (我们的核心经验)**

      * `if` 指令在某些场景下（尤其是在 `location` 内部）行为可能不符合预期，被称为 "if is evil"。
      * `map` 指令更可靠、性能更好，是实现**条件判断和变量赋值**的首选方案，尤其适合处理动态CORS头。

## 配置步骤

### 第一步：创建网站配置文件

为你的应用创建一个新的配置文件。文件名最好是你的域名。

```bash
sudo nano /etc/nginx/sites-available/your_domain.com
```

### 第二步：添加基础反向代理配置

将以下基础配置粘贴到文件中。这是一个最小化的HTTP反向代理。

```nginx
server {
    listen 80;
    server_name your_domain.com www.your_domain.com; # 替换成你的域名

    location / {
        # 将请求转发给在本地3000端口运行的Node.js应用
        proxy_pass http://127.0.0.1:3000; 
        
        # 基础的代理头设置
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # 为WebSocket或SSE等长连接技术提供支持
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 第三步：启用网站并测试

1.  **创建软链接以启用配置**

    ```bash
    sudo ln -s /etc/nginx/sites-available/your_domain.com /etc/nginx/sites-enabled/
    ```

2.  **测试Nginx配置语法**

    ```bash
    sudo nginx -t
    ```

    如果看到 `syntax is ok` 和 `test is successful` 则表示无误。

3.  **重载Nginx使配置生效**

    ```bash
    sudo systemctl reload nginx
    ```

    此时，通过HTTP访问你的域名，应该能看到你的Node.js应用了。

### 第四步：配置SSL/HTTPS (使用Certbot)

这是生产环境的**必需步骤**。

1.  **安装Certbot**

    ```bash
    sudo apt update
    sudo apt install certbot python3-certbot-nginx
    ```

2.  **自动获取并配置证书**

    ```bash
    sudo certbot --nginx -d your_domain.com -d www.your_domain.com
    ```

    Certbot会自动修改你的网站配置文件，添加SSL证书路径并设置HTTP到HTTPS的强制跳转。

### 第五步：配置健壮的CORS策略 (最终方案)

这是解决跨域问题的关键，分为两部分。

#### 1\. 在 `nginx.conf` 中定义 `map`

打开主配置文件：

```bash
sudo nano /etc/nginx/nginx.conf
```

在 `http { ... }` 区块内，`include` 指令的前面，添加 `map` 块。

```nginx
# /etc/nginx/nginx.conf

http {
    # ... 其他所有配置 ...

    ##
    # Virtual Host Configs
    ##

    # 在这里添加 map 块
    map $http_origin $allow_origin {
        default ""; # 默认不允许任何源
        # 允许 your_domain.com 及其所有子域名
        ~*^https?://(.*\.)?your_domain\.com$ $http_origin; 
        # 如果有其他域名需要允许，可以再加一行
        # ~*^https?://(.*\.)?another_domain\.com$ $http_origin;
    }

    include /etc/nginx/conf.d/*.conf;
    include /etc/nginx/sites-enabled/*;
}
```

#### 2\. 更新你的网站配置文件

打开你的网站配置文件：

```bash
sudo nano /etc/nginx/sites-available/your_domain.com
```

将 `server` 块更新为最终的完整版本，它包含了**SSL**、**反向代理**和**CORS头**的所有配置。

```nginx
# /etc/nginx/sites-available/your_domain.com

server {
    server_name your_domain.com www.your_domain.com; # 你的域名

    # ================= CORS Headers =================
    # 使用来自 map 的 $allow_origin 变量
    add_header 'Access-Control-Allow-Origin' "$allow_origin" always;
    add_header 'Access-Control-Allow-Credentials' 'true' always;
    add_header 'Access-Control-Allow-Methods' 'GET, POST, PUT, DELETE, OPTIONS' always;
    add_header 'Access-Control-Allow-Headers' 'Content-Type, Authorization, x-trpc-source, X-Requested-With, Accept, Origin, x-api-key, x-goog-api-key, x-feature-password' always;

    # 处理浏览器的 OPTIONS 预检请求
    if ($request_method = 'OPTIONS') {
        return 204;
    }
    # ===============================================

    location / {
        proxy_pass http://127.0.0.1:3000; # 指向你的Node.js应用
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Certbot自动添加的SSL配置
    listen 443 ssl; 
    ssl_certificate /etc/letsencrypt/live/your_domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your_domain.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
}

# Certbot自动添加的HTTP到HTTPS跳转
server {
    if ($host = www.your_domain.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    if ($host = your_domain.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    server_name your_domain.com www.your_domain.com;
    return 404; # managed by Certbot
}
```

修改完成后，再次**检查并重载 Nginx**：

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## 故障排查

  - **502 Bad Gateway**：通常意味着 `proxy_pass` 指向的Node.js应用没有运行，或者端口号不正确。请检查你的 `pm2` 状态。
  - **CORS 错误依旧**：
    1.  清空浏览器缓存。
    2.  在你的**本地电脑**上使用 `curl` 命令检查响应头：`curl -i -H "Origin: https://your_allowed_domain.com" https://your_domain.com/api/endpoint`。
  - **应用无法连接外部API**：这与Nginx无关。请检查Node.js应用的**环境变量**（如 `.env` 文件中的API密钥）是否在服务器上正确配置，并检查服务器的**出口防火墙**规则。