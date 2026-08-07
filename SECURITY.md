# Security Policy / 安全策略

## Reporting a Vulnerability / 报告安全漏洞

We take security seriously. If you discover a vulnerability, **please do not open a public issue**. / 我们非常重视安全问题。如发现漏洞，**请勿公开提交 issue**。

Instead, report it privately so we can fix it before it is disclosed: / 请私下报告，以便我们在公开前完成修复：

- **Email**: [tobenot@users.noreply.github.com](mailto:tobenot@users.noreply.github.com) — include a subject prefixed with `[Security]`. / 邮件标题请加 `[Security]` 前缀。
- **GitHub**: create a [private security advisory](https://github.com/tobenot/Basic-Web-Game-Backend/security/advisories/new). / 在 GitHub 上创建私有安全公告。

### What to include / 请提供

- The affected version(s) / 受影响版本
- A minimal reproduction (steps, payload, environment) / 最小复现（步骤、载荷、环境）
- Your suggested impact assessment (e.g. severity, data exposed) / 影响评估（如严重程度、受影响数据）

### What we promise / 我们的承诺

- We acknowledge receipt within **72 hours**. / 我们将在 **72 小时内**确认收到。
- We keep you informed of the fix progress. / 我们会持续告知修复进展。
- We do not disclose the report until a fix is released, unless you agree otherwise. / 除非你同意，否则在修复发布前不会公开该报告。

## Supported Versions / 支持的版本

We recommend always running the latest release. Security fixes are backported on request. / 建议始终使用最新版本；如需，可请求将安全修复回移植到旧版本。

| Version | Supported |
| ------- | --------- |
| latest | ✅ |
| previous minor | ⚠️ on request |
| older | ❌ |

## 部署安全基线 / Deployment hardening checklist

部署与重部署时逐项确认，详见 `deploy/pm2/README.md` 与 `AUTH_CONFIGURATION.md`。

1. **JWT_SECRET**：非开发环境必须设置、且不能等于默认值 `your-secret-key`，否则拒绝启动。启动日志只显示 `[REDACTED]`，不打印明文。
2. **env 无重复键**：`dotenv` 重复键后者覆盖前者——`AI_AUTH_REQUIRED` 曾因重复出现 `true`/`false` 被静默改成 false。每个变量只写一次。
3. **HOST 绑 127.0.0.1**：不要把 3000 端口暴露到公网。`trustProxy` 只信任本机回环，直连时 `X-Forwarded-For` 不可信，IP 限流才有意义。
4. **CORS 精确源白名单**：Nginx 用逐条 `origin` 精确匹配，不用正则放行整个子域。
5. **TLS**：`ssl_protocols TLSv1.2 TLSv1.3`，`server_tokens off`。
6. **环境变量唯一来源**：运行时只读 `/etc/bwb/bwb.env`（经 `bin/start` source），不要把 env 打进发布包。

