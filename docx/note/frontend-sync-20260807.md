# 前端同步说明（后端安全加固 2026-08-07）

> 后端（`Basic-Web-Game-Backend`）做了安全加固，涉及 **2 个破坏性变更** + **若干新增行为**。
> 本文给前端开发交接用。仓库内 `test.html` 已按新方式更新，可作参照。

---

## 一、破坏性变更

### 1. `auth.verifyMagicToken` 由 query 改为 mutation

**原因**：token 之前放在 URL query 里，会落访问日志 / Referer / 浏览器历史。现在改为 POST，token 走请求体。

**之前**：
```ts
trpc.auth.verifyMagicToken.query({ token })   // GET /api/trpc/auth.verifyMagicToken?input=...
```

**现在**：
```ts
const { sessionToken } = await trpc.auth.verifyMagicToken.mutate({ token });  // POST
```

- 返回结构不变：`{ sessionToken }`
- 用裸 `fetch` 的写法（与仓库 `test.html` 一致）：
  ```js
  const res = await fetch(`${API_BASE}/auth.verifyMagicToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  ```
- 注意：现在 **GET** 访问该端点会返回 **405**（不再是合法请求）。

### 2. `corsDebug.*` 生产环境不再提供

`corsDebug.getConfig` / `testOrigin` / `testPreflight` / `health` **仅开发环境注册**。

- 生产环境调用 → 404 `No procedure found on path "corsDebug.xxx"`。
- 前端改动：CORS 调试面板只在开发环境使用；生产调用要能优雅处理失败。
- 如果前端没用到 `corsDebug`，这一条可以忽略。

---

## 二、新增行为：限流

后端加了内存限流，超限会返回 **HTTP 429**，错误消息为「请求过于频繁，请稍后再试。」（tRPC 里是 `TOO_MANY_REQUESTS`）。

| 接口 | 限流策略 | 超限表现 |
|---|---|---|
| `auth.requestLoginLink` | 每邮箱 5 次/小时；每 IP 10 次/小时 | 429 `TOO_MANY_REQUESTS` |
| `auth.verifyMagicToken` | 每 IP 10 次/15 分钟 | 429 |
| `auth.verifyEmailCode` | 每 IP 10 次/15 分钟 | 429 |
| `/v1/chat/completions`、`/api/v1/chat/completions`、tRPC `chatCompletions` | 每 IP 20 次/分钟 | HTTP 429，body `{ error: "Too Many Requests", message: "请求过于频繁，请稍后再试。" }` |

**前端建议**：

1. 区分「限流」和「验证失败/链接无效」，给用户展示准确的提示，不要把所有错误都当成"链接无效或已过期"。
2. 收到限流后**不要立刻重试**（建议退避，比如 30 秒以上）。
3. 判断方式：
   - tRPC client：`error.data?.code === 'TOO_MANY_REQUESTS'`，或 `error.message` 含「请求过于频繁」。
   - 裸 fetch：看 HTTP 状态码 429。

---

## 三、类型契约（`@tobenot/basic-web-game-backend-contract`）

- `AppRouter` 类型变化：
  - `verifyMagicToken` 由 `query` 变 `mutation`。
  - `corsDebug` 变为条件注册（生产构建下类型里没有）。
- 需要**重新发布 contract npm 包并让前端升级依赖**，否则前端按旧类型调 `.query()` 会编译报错。
  - 重发流程：`npm run publish` 或触发 `.github/workflows/publish-contract*.yml`。

---

## 四、其他（一般不需要前端改动）

- 后端响应新增安全头：`X-Content-Type-Options: nosniff`、`X-Frame-Options: DENY`、`Referrer-Policy: no-referrer`。
  - 前端**不要依赖 `Referer` 头传递任何信息**。
- 生产环境缺少 `JWT_SECRET` 时后端会拒绝启动（运维项，与前端无关）。
- 静态托管收紧：`/` 路径只暴露 `test.html`、`cors-test.html`、`test-cors.html`、`announcement.txt` 四个文件，其余一律 404。
  - 如果前端直接引用后端 `/` 下的其它资源，需要确认在白名单内。

---

## 五、仓库内可参考的实现

- `test.html` → `verifyToken()`：展示了 `verifyMagicToken` 以 mutation 方式调用的完整写法。
- 部署与契约重发流程：见 `CONFIGURATION.md`、`.github/workflows/publish-contract*.yml`。

---

## 需要前端改动的清单（速查）

- [ ] `verifyMagicToken`：`.query()` → `.mutate()`（含裸 fetch 场景）
- [ ] 处理 4 个接口的 429 限流错误（提示 + 退避）
- [ ] `corsDebug.*` 仅在开发环境使用（或优雅处理 404）
- [ ] 升级 `@tobenot/basic-web-game-backend-contract` 到重发后的版本
