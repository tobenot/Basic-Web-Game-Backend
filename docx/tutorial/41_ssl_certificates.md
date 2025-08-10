### 41｜为你的后端启用 HTTPS（证书获取与自动续期）

本篇讲清楚如何用你自己的域名，免费签发并自动续期 HTTPS 证书。分 Windows Server 与 Linux 两套做法。

#### 前置条件

- 已拥有一个域名
- 域名 DNS 已添加 A 记录指向你的服务器公网 IP
- 放行 80/443 端口

---

## Windows Server：IIS + win-acme（推荐）

目标：用 IIS 反向代理到 Node（监听内网端口，如 8088），证书由 win-acme 自动签发与续期。

### 步骤 1：安装 IIS 与必须组件

1) 打开“添加角色和功能”，勾选 Web 服务器（IIS）
2) 额外安装：URL Rewrite、Application Request Routing（ARR）
   - 可在微软官网/微软 Web 平台安装程序中安装

### 步骤 2：创建站点与反向代理

1) 在 IIS 管理器中新建网站
   - 站点名：你的域名
   - 物理路径：任意空目录
   - 绑定：先只绑定 HTTP:80 + 你的域名
2) 启用反向代理
   - 在根节点“Application Request Routing Cache”→ Server Proxy Settings → 勾选 Enable Proxy
3) 配置 URL Rewrite 反向代理到 Node
   - 在站点下“URL Rewrite”→ Add Rule(s) → Reverse Proxy → 填写内网目标 `127.0.0.1:你的PORT`

此时用 `http://你的域名/health` 应可访问到 Node。

### 步骤 3：安装并运行 win-acme（wacs）签发证书

1) 下载 win-acme（wacs.exe）
   - 访问 `https://www.win-acme.com/` → Downloads → x64 便携版
2) 解压到如 `C:\tools\win-acme`，以管理员运行 `wacs.exe`
3) 交互选择
   - N：Create new certificate (simple)
   - 选择你的站点或手动输入域名
   - HTTP-01 验证（默认），程序会在 80 口自动完成验证
   - 自动将证书安装到 IIS 并创建 HTTPS:443 绑定
   - 创建计划任务，实现自动续期

完成后，`https://你的域名` 生效。

### 步骤 4：强制跳转 HTTPS（可选）

在站点下“URL Rewrite”添加 HTTPS 重定向规则，将 HTTP 重定向到 HTTPS。

### 常见问题

- 80 端口必须对公网可达，否则 HTTP-01 无法验证
- 若使用 CDN/Cloudflare 且橙云代理，颁发时建议临时灰云，或使用 DNS-01（win-acme 也支持）
- 续期由计划任务自动完成；如需手动续期，可再次运行 `wacs.exe`
- 导出 PFX：打开“计算机证书”MMC → 个人 → 证书 → 找到你的域名证书 → 右键“所有任务”→ 导出（包含私钥）

---

## Linux：Nginx + Certbot（推荐）

目标：Nginx 反向代理 443/80，Certbot 自动签发与续期。

### 步骤 1：安装 Nginx 与 Certbot

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
```

### 步骤 2：配置站点并反代到 Node

```bash
sudo nano /etc/nginx/sites-available/api.yourdomain.com
```

```nginx
server {
	listen 80;
	server_name api.yourdomain.com;
	location / {
		proxy_pass http://127.0.0.1:8088;
		proxy_http_version 1.1;
		proxy_set_header Upgrade $http_upgrade;
		proxy_set_header Connection "upgrade";
		proxy_set_header Host $host;
	}
}
```

```bash
sudo ln -s /etc/nginx/sites-available/api.yourdomain.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

确保 `http://api.yourdomain.com/health` 可达。

### 步骤 3：一键签发与自动续期

```bash
sudo certbot --nginx -d api.yourdomain.com
```

选择强制跳转 HTTPS。完成后自动创建定时续期任务。

验证：`https://api.yourdomain.com/health`

### 证书位置与续期

- 证书目录：`/etc/letsencrypt/live/你的域名/`
- 常用文件：`fullchain.pem`、`privkey.pem`
- 自动续期：每日检查，到期前会自动续期

```bash
sudo systemctl list-timers | grep certbot
sudo certbot renew --dry-run
```

### 备选：不改 Nginx，仅临时签证书

```bash
sudo systemctl stop nginx
sudo certbot certonly --standalone -d api.yourdomain.com
sudo systemctl start nginx
```

或使用 DNS-01（适合在 80/443 受限、或需通配符证书）：

- 安装对应 DNS 插件（如 Cloudflare：`python3-certbot-dns-cloudflare`）
- 按插件文档配置 API Token 后执行带 `--dns-...` 的 certbot 命令

---

## Node 直挂 443 与导出证书

- 生产建议用反向代理托管证书，不建议 Node 进程直接监听 443
- 如确需 Node TLS，Linux 下使用 `fullchain.pem` 与 `privkey.pem`
- Windows 下可在证书管理器导出 PFX，并在 Node 中加载

---

## 排错

- 域名未解析或解析未生效：检查 DNS A 记录与 TTL
- 80/443 未通：检查云服务商安全组与系统防火墙
- 被占用端口：调整 Nginx 端口或释放占用
- Cloudflare 橙云：签发阶段临时灰云，或改用 DNS-01

---

## 最佳实践

- 后端仅监听内网端口，如 8088
- 所有外部访问通过 IIS/Nginx 走 HTTPS
- 自动续期要么由 win-acme 计划任务，要么由 certbot 定时任务
- 生产前用 `https://www.ssllabs.com/ssltest/` 检查评分


