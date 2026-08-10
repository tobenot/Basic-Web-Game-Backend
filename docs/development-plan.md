# AI 游戏后端套件 — 开发计划

> 版本：v1
> 日期：2026-08-11
> 状态：**✅ 全部实施完成**（Phase 1-5 已落地，见各 Task 勾选与 §11 变更记录）
> 背景方案：`docs/ai-game-suite-proposal.md`（方案稿 v0.1）

## 0. 执行指引（给下一个窗口）

> 本次已全部完成。以下保留原文供追溯；后续只需在引入新变更时保持勾选与「明确不做」清单不被误破。

---

## 1. 背景与目标

目标：把现有单游戏、登录制、共享密钥门禁的 AI 代理后端，补齐为「多游戏、匿名、额度制、预算硬顶」的 AI 游戏后端套件。首发场景《文明史诗》NPC AI 对话，公测、无登录、点开即玩。

**核心判断：这是「补齐」，不是「转向」也不是「重写」。** 方案文档的增量能力只有四样：匿名会话、额度/兑换码、全局预算硬顶、多游戏配置（`game_id`）。其余（LLM 代理、多供应商流式、限流、CORS 加固、部署）现有代码已具备。

---

## 2. 现状盘点

### 2.1 已有（直接复用，不改）

| 能力 | 位置 |
|---|---|
| OpenAI 兼容 LLM 代理 | `src/framework/routers/llm-proxy.ts`（`POST /v1/chat/completions` + `/api/v1/chat/completions`） |
| 多供应商路由 | 模型前缀 `gemini-*` / `deepseek*` / `openai/*` / `openrouter/*`（`getProviderAndModel`） |
| SSE 流式 + 推理/正文分离 | `reasoning_content`，`?reasoning_to_content=1` 合并 |
| 每 IP 限流 | `src/framework/utils/rate-limit.ts` 内存固定窗口，LLM 路由 20 次/分钟 |
| 客户端断开中止上游 | `AbortController` + reply `close` 监听 |
| 全局请求节流队列 | `src/ai/AiRequestQueueService.ts`（高峰/低谷动态间隔） |
| 登录体系（可选账户层） | `authRouter`（魔法链接 + OTP）、`src/middleware/auth.ts`、`src/config/auth.ts` |
| CORS 加固 | 应用层 `src/config/cors.ts` + Nginx 精确源白名单（`Nginx/`） |
| 部署 | PM2 原子发布 + 健康检查回滚（`deploy/pm2/`）、Vercel 可选 |
| 类型契约包 | `@tobenot/basic-web-game-backend-contract`（`AppRouter` type） |

### 2.2 缺失（本次要补）

| 能力 | 缺口 |
|---|---|
| 多游戏配置（`game_id`） | 完全无。新游戏接入要改代码 |
| 匿名会话 | 现状仅邮件登录 + JWT Bearer；无 cookie 会话 |
| 每会话每日免费额度 | 无 |
| 兑换码 | 无 |
| 全局预算硬顶（熔断） | 无 |
| Cloudflare Turnstile 人机验证 | 无 |
| 前端 SDK（fetch + SSE + 会话 + Turnstile） | 无（`test.html` 只调过 tRPC auth，**无 SSE 消费代码**） |
| 降级兜底文案 | 仅基础错误处理，无按游戏可配的降级策略 |
| AI 流式接口的类型契约 | `AppRouter` 只覆盖 tRPC procedure，**不含** `/v1/chat/completions` |

### 2.3 契约包关键事实（影响 T9 设计）

- `main: dist/server.js` = **编译后的完整 Node 后端服务**，浏览器 import 直接崩，绝不能当 SDK 用。
- `types: dist/server.d.ts` 只导出 `export type { AppRouter } from './app'`，type-only，零运行时。
- AI 流式接口是**纯 HTTP 路由**（`server.post`），不在 `AppRouter` 内 → 前端无 AI 类型可用。
- 结论：契约包 = 类型契约（tRPC 部分）；SDK = 独立运行时单文件。两者是同一故事的两个产物。

---

## 3. 已定决策（吸收全部讨论，开工不要推翻）

- **D1 — 不新开仓库，本仓库增量补。** 理由：复用率高（CORS 白名单安全补丁、部署脚本、Gemini 流式解析器、限流全要重做）、历史是资产（近期 commit 全是安全加固）、多游戏 = 一个配置字段（纯 YAGNI）。
- **D2 — 匿名会话优先，登录作为可选账户层保留。** 产品目标是公测无登录点开即玩。现有 `AI_AUTH_REQUIRED` / JWT / 邮箱登录**全部原样保留**，变可选账户层。匿名 token 复用现有 JWT 基础设施（同一 `JWT_SECRET`）。「匿名 → 绑定邮箱升级保留额度」后置。
- **D3 — `x-feature-password` 降级为开发期白名单。** 共享密钥放前端必被扒走，与方案「防线全在服务端」冲突。**不删代码**（开发期有用），文档标注其定位，**公测前必须移除**（见 T11）。
- **D4 — 多游戏 = 配置条目，不平台化。** `game_id` 就是请求读一个字段、查一个配置对象。每游戏 prompt 模板/分档额度/降级差异化等「多游戏平台化」**等真出现第二款游戏再做**。
- **D5 — SDK 先单文件，npm 发布等第一款游戏接入。** 契约包（类型）和 SDK（运行时）是两个独立版本化周期，契约包已覆盖类型一半。
- **D6 — 契约包补齐 AI 类型，闭合 SDK 类型**（用户明确要求）。
- **D7 — 预算/限流/会话验证用内存实现（单实例）。** 部署是 `instances: 1`，够用；多实例/Serverless 需换 Redis，届时加注释升级路径。

---

## 4. 目标架构（改造后）

```
游戏A 前端（静态页） ─┐
游戏B 前端 ──────────┼─ HTTPS + 匿名会话 cookie ─▶ Nginx(公网入口, 精确CORS白名单)
                     │                                │ proxy_pass
                     ▼                                ▼
                   前端 SDK（sdk/ai-game-sdk.js，随游戏分发）    Fastify 服务(单实例)
                                                              ├─ 匿名会话中间件(签发/解析 HttpOnly cookie JWT)
                                                              ├─ game_id 配置选择器(src/config/games.ts)
                                                              ├─ LLM 代理(已有) + 额度消耗 + 预算熔断
                                                              ├─ Turnstile 校验端点
                                                              ├─ 兑换码 tRPC router
                                                              └─ Prisma: QuotaUsage / SessionCredit / RedeemCode
```

- 无登录、无注册：玩家点开即玩，额度按匿名会话发放。
- 防护五层：Turnstile（首访 AI 触发）→ 每 IP 限流（已有）→ 每会话每日额度硬上限（新增）→ 全局预算硬顶（新增）→ 熔断降级文案（新增）。

---

## 5. 分阶段实施

> 每 Task 给：`文件` / `改动` / `验收`。验收是「跑一下能看到」的最小检查（本仓库无测试框架，用 node assert 自检脚本或 curl，见 §8）。

---

### Phase 1 — 核心：匿名会话 + 额度 + 兑换码 + 预算 + game_id

> 这是最大且必须先做的一期，其余 Phase 依赖它的接口形状。做完 Phase 1 即可支撑《文明史诗》「每日免费额度 + 兑换码」的最小闭环。

#### T1 匿名会话中间件
- `文件`：新建 `src/middleware/anonymous-session.ts`；改 `src/app.ts`、`src/middleware/auth.ts`、`src/trpc.ts`
- `改动`：
  - 新建：`parseSessionFromCookie(request)` 手动解析 `Cookie` header（`split(';')` 即可，**不引 @fastify/cookie 依赖**），`jwt.verify` 出 `{ kind: 'anon', sid }`；`ensureAnonymousSession(request, reply)`：无有效会话时 `randomUUID()` 生成 `sid`，`jwt.sign({ kind: 'anon', sid }, JWT_SECRET, { expiresIn: JWT_EXPIRY })`，`set-cookie`：
    - 名 `bwb_sid`；`HttpOnly`；`Path=/`；`Max-Age=30d`；生产 `Secure`
    - **SameSite 见 §9 风险 R1（跨站游戏关键决策，先读再写）**
  - `app.ts`：`onRequest` hook 调 `ensureAnonymousSession`（全局即可，静态白名单文件除外）
  - `middleware/auth.ts` `createAuthContext`：现有 Bearer 登录逻辑保留；**新增** cookie 匿名解析，`AuthContext` 加 `sessionId?: string`。两者取其一：有 Bearer 且有效 → 登录身份；否则 cookie → 匿名身份
  - `trpc.ts`：`Context` 类型加 `sessionId?: string`
- `验收`：curl 首次带空 cookie 打 `/api/trpc/auth.healthCheck` → 响应 `set-cookie: bwb_sid=...`；第二次带该 cookie → 不再 set。

#### T2 额度数据模型（Prisma）
- `文件`：`prisma/schema.prisma.template`（**模板是源**，`scripts/generate-prisma-schema.js` 按 provider 生成 `schema.prisma`）；迁移
- `改动`：加三个 model
  ```prisma
  model QuotaUsage {
    id          String   @id @default(cuid())
    sessionId   String
    gameId      String
    date        String   // YYYY-MM-DD
    usedTokens  Int      @default(0)
    usedRequests Int     @default(0)
    updatedAt   DateTime @updatedAt
    @@unique([sessionId, gameId, date])
  }

  model SessionCredit {
    id             String @id @default(cuid())
    sessionId      String
    gameId         String
    remainingTokens Int   @default(0)
    updatedAt      DateTime @updatedAt
    @@unique([sessionId, gameId])
  }

  model RedeemCode {
    id             String    @id @default(cuid())
    code           String    @unique
    gameId         String
    tokenAmount    Int
    usedBySessionId String?
    usedAt         DateTime?
    createdAt      DateTime  @default(now())
    expiresAt      DateTime?
  }
  ```
  - 迁移：本地 `npm run migrate:dev`；生产 `npm run migrate:deploy`（随部署）
- `验收`：`npm run migrate:dev` 成功；`prisma studio` 能看到三张表。

#### T3 game_id 配置选择器
- `文件`：新建 `src/config/games.ts`
- `改动`：
  - `GameConfig`：`{ id, name, defaultModel?, dailyFreeTokens, degradedMessage }`
  - `getGameConfig(gameId): GameConfig | null`；未知 `gameId` 拒绝（防误扣其他游戏额度）
  - 默认 `gameId` 由 env `DEFAULT_GAME_ID` 指定，请求缺省时回退
  - 配置先写常量对象 + env 覆盖（多游戏平台化后置，见 YAGNI）
- `验收`：起服务后 node 调 `getGameConfig('未知')` 返回 null；已知 id 返回配置。

#### T4 额度消耗 + 全局预算熔断
- `文件`：新建 `src/ai/budget.ts`；改 `src/framework/routers/llm-proxy.ts`
- `改动`：
  - `budget.ts`：内存计数器（单实例；注释标明多实例需 Redis）。接口：`record(usage)`、`getStatus()`、`isExhausted()`。上限读 env：`AI_DAILY_BUDGET_TOKENS`（或 `AI_DAILY_BUDGET_USD` 换算，二选一，**默认 tokens 优先**）；每日重置（内存定时器或惰性按日期键）
  - `llm-proxy.ts` handler 内（有 `request`/`reply`）：
    1. 从 cookie 取 `sessionId`（复用 T1 解析）
    2. **消耗前检查**：当日已用（`QuotaUsage`）< `dailyFreeTokens` + `SessionCredit.remainingTokens`，否则 → `429` + 降级文案（T7）
    3. `budget.isExhausted()` → `429/503` + 降级文案（T7）
    4. **响应后扣减**：从上游响应提取 usage。非流式取 `usage`；流式取最后一个 chunk 的 `usage`（DeepSeek 标准；Gemini 解析 `usageMetadata`）。**这是最大不确定点，见 §9 R2**。更新 `QuotaUsage.usedTokens/usedRequests`（upsert by `sessionId+gameId+date`），有 `SessionCredit` 先扣 credit
- `验收`：自检脚本 `scripts/selfcheck-budget.mjs`——mock usage 把 `AI_DAILY_BUDGET_TOKENS` 打到超限，`isExhausted()` 变 true；额度扣减后 `QuotaUsage` 行存在且值正确。

#### T5 兑换码
- `文件`：新建 `src/framework/routers/redeem.ts`；改 `src/app.ts`
- `改动`：`redeem.redeemCode`（publicProcedure，需 session cookie）输入 `{ code, gameId }`：
  - 查 `RedeemCode`：不存在/已过期 → 报错；`usedBySessionId` 非空 → **幂等拒绝**（同一 code 第二次报「已使用」）
  - 成功后原子更新：`usedBySessionId=本session`, `usedAt=now`，`SessionCredit` upsert `remainingTokens += tokenAmount`
  - 注册进 `app.ts` router
- `验收`：自检脚本 `scripts/selfcheck-redeem.mjs`——两次 redeem 同一 code，第二次报错；`SessionCredit` 余额正确累加。

#### T7 降级文案（并入 Phase 1 收尾）
- `改动`：`llm-proxy.ts` 的 429/熔断分支统一返回 `{ error, code, degradedMessage }`，`degradedMessage` 从 `getGameConfig(gameId)` 读
- `验收`：额度耗尽请求返回 `degradedMessage` 非空。

---

### Phase 2 — 防护：Turnstile

#### T6 Turnstile 人机验证
- `文件`：新建 `src/framework/routers/turnstile.ts`；改 `llm-proxy.ts`、`app.ts`
- `改动`：
  - env `TURNSTILE_SECRET_KEY`、开关 `TURNSTILE_ENABLED`（默认 false，开发不打搅）
  - `turnstile.verifyCode`（publicProcedure，需 session）：调 `https://challenges.cloudflare.com/turnstile/v0/siteverify` 校验 token → 标记该 session 已验证（内存 `Set<sessionId>`，单实例；多实例需 Redis）
  - `llm-proxy.ts`：`TURNSTILE_ENABLED` 时，session 未验证 → `403 { code: 'turnstile_required' }`（SDK 据此触发前端 widget）
- `验收`：`TURNSTILE_ENABLED=true` 下未验证请求 → 403 `turnstile_required`；verify 后 → 放行。

---

### Phase 3 — SSE 归一化 + 契约包 AI 类型

#### T8 SSE 归一化 + usage 契约
- `文件`：`src/framework/routers/llm-proxy.ts`
- `改动`：
  - **先核对现状**：Gemini 分支已转 OpenAI `chat.completion.chunk`（sseChunk 对象）；DeepSeek 分支直接透传（上游本就是 OpenAI 格式）。**已基本归一化**，本任务 = 确认三条路径输出统一 + 流式 usage 提取（接 T4 的扣减点）+ 明确 `reasoning_content` 字段契约（SDK 据此区分推理/正文）
  - 输出形状一旦契约化即为 breaking change，见 T9 版本策略
- `验收`：curl 流式请求（gemini + deepseek 各一）→ 输出均为标准 `data: {...}\ndata: [DONE]`，末 chunk 带 `usage`。

#### T9 契约包补 AI 类型（D6）
- `文件`：新建 `src/types/ai-contract.ts`；改 `src/app.ts`；发布入口
- `改动`：
  - `ai-contract.ts` 导出：`ChatCompletionRequest`、`ChatCompletionChunk`、`ChatCompletionResponse`、`TurnstileRequiredError`（从 `llm-client.ts` 的 `ChatCompletionParams` 与 llm-proxy 输出形状提炼，**以 T8 定型后的实际形状为准**）
  - `app.ts` re-export；发布入口 `dist/server.d.ts` 改为 `export * from './app'`（让 AI 类型随契约包露出）
  - **版本策略**：只新增导出、不改现有类型 → minor；若 T8 改变响应形状 → 与 SDK 一起发 major
- `验收`：`npm run build` 后 `dist/server.d.ts` 含 AI 类型；前端可 `import type { ChatCompletionRequest } from '@tobenot/basic-web-game-backend-contract'`。

---

### Phase 4 — 前端 SDK

#### T10 SDK 单文件 `sdk/ai-game-sdk.js`
- `文件`：新建 `sdk/ai-game-sdk.js`、`sdk/demo.html`（**不发布 npm，D5**）
- `改动`：
  - `AiGameSDK.init({ gameId, apiBase, turnstileSiteKey? })`
  - `chat(messages, { stream, onChunk, signal })`：`fetch(..., { credentials: 'include' })` → `ReadableStream.getReader()` → `TextDecoder` 按行切分 SSE → 逐 chunk 回调。**约 40 行的标准套路**，`test.html` 无现成可抄，净新增
  - 会话管理：**无**（HttpOnly cookie 浏览器自动管，SDK 只保证 `credentials: 'include'`）
  - Turnstile：捕获 `403 turnstile_required` → 显式渲染 widget → 拿 token → 调 `turnstile.verifyCode` → 重试原请求（约 20 行，官方文档照着写）
  - `redeem(code)`
  - 纯原生 fetch，零依赖
  - demo.html 引用 SDK，模拟 `stream` 输出
- `验收`：起后端，demo.html 完成一次流式对话 + 一次兑换码。

---

### Phase 5 — 部署、配置、安全基线、文档

#### T11 配置与安全收尾
- `文件`：`.env.example`、`.env.publish`、`deploy/pm2/README.md`、`Nginx/`、README
- `改动`：
  - `.env.example` / `.env.publish` 加：`TURNSTILE_SECRET_KEY`、`TURNSTILE_ENABLED`、`AI_DAILY_BUDGET_TOKENS`、`DEFAULT_GAME_ID`、`REDEEM_CODE_*`（如需要）
  - 部署手册「必填环境变量清单」同步新增项
  - Nginx CORS 精确白名单：加新游戏前端域名（**用占位符**，具体值留在服务器/本地配置，不进公开仓库）
  - `x-feature-password`：文档明确标注「开发期白名单，公测前移除」定位
  - README 功能特性/部署章节同步
- `验收`：文档无占位符泄漏；`x-feature-password` 定位表述到位。

---

## 6. 明确不做（YAGNI，开工不要碰）

- ❌ **多游戏平台化**：每游戏 prompt 模板、分档额度、降级文案差异化 —— 等真出现第二款游戏再做
- ❌ **东京→广州转发 + Caddy + Cloudflare CDN** —— 现状单服务器 Nginx 够首发；上公网 CDN 时再议
- ❌ **SDK npm 发布** —— 第一款游戏接入后，现在打包 = YAGNI
- ❌ **多实例限流/预算/会话验证换 Redis** —— `instances: 1` 够
- ❌ **匿名→邮箱绑定升级保留额度** —— 玩家真需要时再做
- ❌ **新开仓库重写**（D1）

---

## 7. 服务器侧操作清单（部署时照做）

> 具体值（域名/IP/密钥）不在本文件，留在服务器 `/etc/bwb/bwb.env` 与本地 gitignored 配置。

- [ ] 迁移：`npm run migrate:deploy`（随发布脚本，`MIGRATE_ON_DEPLOY=1`）
- [ ] `/etc/bwb/bwb.env` 增补：`TURNSTILE_SECRET_KEY`、`TURNSTILE_ENABLED`、`AI_DAILY_BUDGET_TOKENS`、`DEFAULT_GAME_ID`
- [ ] Nginx 精确 CORS 白名单加 `<新游戏前端域名>`（同步 `Nginx/nginx.conf` map 块 + `sites-available` 的 `add_header Access-Control-Allow-Origin`），`nginx -t && systemctl reload nginx`
- [ ] 若 `SameSite=None`（见 R1）：确认站点有 HTTPS，浏览器同站/跨站行为符合预期
- [ ] 公测前：`FEATURE_PASSWORD_ENABLED` 置为 false / 移除 `FEATURE_PASSWORDS`（D3）

---

## 8. 验收与自检（ponytail：非平凡逻辑必须留一个可运行检查）

仓库无测试框架，每 Phase 交付时留**一个**最小自检（node assert 脚本或 curl 清单），脚本放 `scripts/selfcheck-*.ts`：

- [x] `scripts/selfcheck-budget.ts`（T4）：预算熔断真触发 —— **已跑通**
- [x] `scripts/selfcheck-redeem.ts`（T5）：兑换码幂等 —— **已在 SQLite 上跑通**
- [x] 额度扣减验证（T4）：一次对话后 `QuotaUsage` 行正确 —— **集成测试确认：失败调用不扣额度，兑换 credit 入账正确**
- [x] 流式 curl 清单（T8）：两供应商输出格式统一 —— **代码路径确认：DeepSeek 逐行解析取 usage、Gemini usageMetadata、其余透传（OpenAI 格式）**

---

## 9. 风险与注意

- **R1 — 跨站 cookie（SameSite）【写 T1 前必读】**：`html-classic.itch.zone` 已在 CORS 白名单，说明真实存在第三方 iframe 游戏。`SameSite=Lax` 下**第三方 iframe 的跨站请求不会带 cookie** → 匿名会话失效。处理：匿名 cookie 用 `SameSite=None; Secure`（生产）牺牲 CSRF 防护、由「每日额度封顶」兜底损失；或所有游戏站同域部署用 `Lax`。**按实际部署拓扑在 T1 定死，写注释说明权衡。**
- **R2 — 流式 usage 提取是最大不确定点**：DeepSeek 标准 `usage`（final chunk）、Gemini 需解析 `usageMetadata`，两供应商格式不同。T4 先实现非流式 usage + 流式尽力，T8 归一化时补全；若某供应商流式拿不到 usage，用请求计数兜底（`usedRequests` 字段已留）。
- **R3 — 契约包 type-only**：前端绝不要 `import { ... }`（运行时）契约包，只能 `import type`；否则拉到编译后的 Node 服务。SDK 才是运行时入口。
- **R4 — 多人工协作**：改 `prisma/schema.prisma.template` 与 `llm-proxy.ts` 时注意他人可能同时在改；提交前 `git diff` 只 add 自己部分。

---

## 10. 依赖关系速查

```
T1 匿名会话 ──▶ T4 额度消耗（要 sessionId）
T2 模型 ──────▶ T4/T5（要表）
T3 game_id ──▶ T4/T5/T7（要配置）
T4 额度+预算 ─▶ T7 降级文案
T2+T3+T5 ────▶ Phase 1 闭环
T8 归一化 ───▶ T9 类型（形状定型）
T1+T6+T8+T9 ─▶ T10 SDK
T10 ─────────▶ T11 文档/部署收尾
```

---

## 11. 变更记录（2026-08-11 实施完毕）

### 已落地

| Phase | Task | 落点 | 备注 |
|---|---|---|---|
| 1 | T1 | `src/middleware/anonymous-session.ts`；`auth.ts`/`trpc.ts`/`app.ts` | cookie 名 `bwb_sid`；SameSite 由 `ANON_COOKIE_SAMESITE` 控制，生产默认 None、开发 Lax |
| 1 | T2 | `prisma/schema.prisma.template` + 迁移 `20260811000000_add_quota_redeem` | `QuotaUsage`/`SessionCredit`/`RedeemCode`；迁移 SQL 用 `prisma migrate diff` 离线生成（本地 PG 未起） |
| 1 | T3 | `src/config/games.ts` | `getGameConfig`/`getDefaultGameId`；`GAMES_CONFIG` env 覆盖 |
| 1 | T4 | `src/ai/budget.ts`、`src/ai/quota.ts`；`llm-proxy.ts`；`gemini-client.ts` | budget 内存计数；`checkQuota` 事前 + `recordUsage` 事后（先扣 credit 再记当日）；gemini 补 usage 输出；流式 usage 提取 + 估算兜底 |
| 1 | T5 | `src/ai/redeem.ts`、`src/framework/routers/redeem.ts`、`scripts/seed-redeem-codes.js` | `claimRedeemCode` 原子认领幂等 |
| 1 | T7 | `llm-proxy.ts` 429/503 分支 | 返回 `degradedMessage` |
| 2 | T6 | `src/framework/routers/turnstile.ts`；`llm-proxy.ts` | 内存已验证 Set + 每日清理 |
| 3 | T8 | `llm-proxy.ts` | 归一化在 T4 一并落地：DeepSeek 逐行解析取 usage + 按需合并推理；Gemini usageMetadata；其余透传 |
| 3 | T9 | `src/types/ai-contract.ts`；`server.ts` re-export | 契约包随发布露出 AI 类型 |
| 4 | T10 | `sdk/ai-game-sdk.js`、`sdk/demo.html` | 零依赖；Turnstile 自动重试；未发布 npm（D5） |
| 5 | T11 | `.env.example`、`.env.publish`(本地)、`deploy/pm2/README.md`、两个 README | 见 §7 |

### 实施中发现并修复的既有 bug

- **LLM 代理同步 preHandler 挂起**：`llmRateLimit` 原为同步函数，通过限流时返回 `undefined`。Fastify 5 的 hook runner（`lib/hooks.js` hookRunnerGenerator）只 await thenable，同步返回非 thenable 时**既不调用 next 也不报错，请求永久挂起**。已改为 `async`。集成测试复现并验证修复。commit `44d3562`。

### 与计划的小偏差

- 自检脚本实为 `scripts/selfcheck-*.ts`（非 `.mjs`），经 npm scripts `selfcheck:budget` / `selfcheck:redeem` 运行。
- `seed-redeem-codes.js` 的 `createMany` 去掉了 `skipDuplicates`（SQLite 不支持），改先查重再插入。
- 集成测试用临时 SQLite（`prisma migrate diff` 生成 PG 迁移、`db push` 建 SQLite 表跑通），本地 PG/Docker 未启动。
- 迁移 SQL 为 Postgres 风格（与既有迁移一致）；若本地要用 SQLite 跑 `migrate dev` 需先切 provider。
