
---

### 📝 问题复盘笔记：Yarn 安装刚发布的 Scoped 包报错 (401 & 404)

#### 1. 问题描述
在安装自己的 Scoped 包（如 `@user/xxxx`）时，过程跌宕起伏：
1.  **起初报错 401 Unauthorized**：Yarn 试图连接 `npm.pkg.github.com` 需要鉴权。
2.  **清理配置后报错 404 Not Found**：发现包虽然在代码中引用，但实际上并未成功同步到 yarn 默认源。
3.  **最终解决**：确认 NPM 官方源有数据，强制指定源后安装成功。

#### 2. 根本原因分析 (Root Cause)

*   **原因一：残留的 Scope 路由配置 (Local Config Override)**
    *   **现象**：虽然 `registry` 设置为了公开源，但 `.npmrc` 或 `package-lock.json` 中残留了 `@user:registry=https://npm.pkg.github.com` 的配置。
    *   **后果**：Yarn 忽略全局设定，强行把针对该 Scope 的包定向到 GitHub Packages（私有源），导致无 Token 时报 `401`。

*   **原因二：镜像站同步延迟 (Registry Sync Latency)**
    *   **现象**：包刚发布到 NPM 官方（`registry.npmjs.org`），浏览器能查到 JSON，但 `yarn install` 报 404。
    *   **原理**：Yarn 默认使用的 `registry.yarnpkg.com` 是 `registry.npmjs.org` 的镜像/缓存副本。两者之间的同步**存在延迟（几分钟到几小时不等）**。
    *   **后果**：源头有了，但中间商（镜像站）还没收到货，所以报 `404`。

#### 3. 解决方案 (Solution)

1.  **清理干扰配置**：
    *   删除项目内及全局 `.npmrc` 中指向 `npm.pkg.github.com` 的配置。
    *   删除 `package-lock.json` / `yarn.lock` 防止锁死错误的 Registry URL。

2.  **跳过镜像，直连源头**：
    *   当包是 **“刚刚发布”** 或 **“版本更新极快”** 时，不要等待 Yarn 镜像同步，直接指定 NPM 官方源安装。

#### 4. 关键命令 (Command Reference)

**查看包在官方源的实际状态（用于 Debug）：**
```powershell
# 查看官方源的元数据，确认 dist-tags.latest 版本是否存在
npm view @你的包名 versions --registry=https://registry.npmjs.org/
```

**最终成功安装命令（强制绕过镜像）：**
```powershell
yarn install --registry=https://registry.npmjs.org/
```
*(注：等到几个小时后镜像同步完成，就可以不加后面参数直接 yarn install 了)*