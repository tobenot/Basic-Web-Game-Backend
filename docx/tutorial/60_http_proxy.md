# HTTP代理配置

## 环境变量

设置以下任一环境变量：

```bash
# HTTP代理
HTTP_PROXY="http://proxy-server:port"

# HTTPS代理  
HTTPS_PROXY="https://proxy-server:port"

# 带认证的代理
HTTP_PROXY="http://username:password@proxy-server:port"

# 自定义全局代理
GLOBAL_HTTP_PROXY="http://proxy-server:port"
```

## 配置方式

### 1. .env文件
```bash
# 本地代理
HTTP_PROXY="http://127.0.0.1:33210"

# 远程代理
HTTP_PROXY="http://proxy.example.com:8080"
```

### 2. 命令行
```bash
# Windows - 本地代理
set HTTP_PROXY="http://127.0.0.1:33210"

# Linux/macOS - 本地代理
export HTTP_PROXY="http://127.0.0.1:33210"

# 远程代理
set HTTP_PROXY="http://proxy.example.com:8080"
export HTTP_PROXY="http://proxy.example.com:8080"
```

### 3. Docker
```yaml
environment:
  # 本地代理
  - HTTP_PROXY="http://127.0.0.1:33210"
  # 远程代理
  - HTTP_PROXY="http://proxy.example.com:8080"
```

## 验证

启动服务器时看到以下日志表示配置成功：
```
🌐 HTTP(S)代理已启用: http://proxy.example.com:8080
```
