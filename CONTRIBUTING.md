# Contributing / 贡献指南

Thanks for taking the time to contribute! / 感谢你抽出时间参与贡献！

This guide applies to both maintainers and external contributors. / 本指南适用于维护者与外部贡献者。

---

## Table of Contents / 目录

- [Development Setup / 环境搭建](#development-setup--环境搭建)
- [Branch & Commit Conventions / 分支与提交规范](#branch--commit-conventions--分支与提交规范)
- [Testing / 测试](#testing--测试)
- [Submitting a Pull Request / 提交 PR](#submitting-a-pull-request--提交-pr)
- [Code of Conduct / 行为准则](#code-of-conduct--行为准则)

## Development Setup / 环境搭建

1. Fork and clone the repository. / Fork 并克隆仓库。
2. `npm install`
3. `cp .env.example .env` and fill in at least `DATABASE_URL` and `JWT_SECRET`. / 至少填写 `DATABASE_URL` 与 `JWT_SECRET`。
4. `npm run migrate:dev`
5. `npm run dev` — the server runs at `http://localhost:3000`. / 服务器运行在 `http://localhost:3000`。

If you don't have a Resend API key, the server still starts — login emails just won't be sent (the magic link and OTP are still printed to the server console in development).

> 没有 Resend 密钥也能启动服务，只是不会真正发送邮件——开发环境下魔法链接和验证码会打印到服务器控制台。

## Branch & Commit Conventions / 分支与提交规范

- Create a feature branch: `git checkout -b feat/your-change`. / 新建功能分支。
- Commit messages should be short and imperative, using conventional prefixes when it fits: / 提交信息简短、祈使语气，尽量使用约定式前缀：

  ```
  feat: add leaderboard endpoint
  fix: validate email before sending magic link
  docs: update auth flow in README
  chore: bump contract package version
  ```

- Keep PRs focused on one change. / 一个 PR 只做一件事。

## Testing / 测试

- There is no automated test suite yet — a one-line `npm test` stub exists. / 目前尚无自动化测试套件。
- Before opening a PR, at minimum: / 提交 PR 前至少做到：
  - `npm run build` passes. / 构建通过。
  - `npm run dev` boots and `/health` returns `{ status: "ok" }`. / 服务可启动且 `/health` 正常。
  - Your change works end-to-end against the test page at `/test.html` where relevant. / 相关改动在 `/test.html` 测试页端到端验证通过。

If you add non-trivial logic (a branch, a loop, a parser, an auth/security path), include a small runnable check with it. / 若新增非平凡逻辑（分支、循环、解析器、认证/安全路径），请附带一个可运行的最小校验。

## Submitting a Pull Request / 提交 PR

1. Sync your branch with `main` before submitting. / 提交前先与 `main` 同步。
2. Fill in the [PR template](.github/PULL_REQUEST_TEMPLATE.md). / 填写 PR 模板。
3. Link any related issue. / 关联相关 issue。
4. Never commit secrets or `.env` files — check `git status` before `git add`. / 绝不提交密钥或 `.env` 文件。

For significant changes, open an issue first to discuss the design before writing code. / 重大改动请先开 issue 讨论设计。

## Code of Conduct / 行为准则

All participants must follow the [Code of Conduct](CODE_OF_CONDUCT.md). Please report unacceptable behavior by opening an issue or contacting a maintainer. / 所有参与者须遵守《[行为准则](CODE_OF_CONDUCT.md)》，如遇不当行为请通过 issue 或联系维护者反馈。
