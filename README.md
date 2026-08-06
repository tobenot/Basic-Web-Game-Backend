# Basic Web Game Backend

**[English](README.md)** | **[简体中文](README.zh-CN.md)**

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-22%2B-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white)](https://fastify.dev/)
[![tRPC](https://img.shields.io/badge/tRPC-11-2596BE?logo=trpc&logoColor=white)](https://trpc.io/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![npm](https://img.shields.io/npm/v/@tobenot/basic-web-game-backend-contract?logo=npm&label=contract)](https://www.npmjs.com/package/@tobenot/basic-web-game-backend-contract)
[![CI](https://github.com/tobenot/Basic-Web-Game-Backend/actions/workflows/publish-contract-npm.yml/badge.svg)](https://github.com/tobenot/Basic-Web-Game-Backend/actions/workflows/publish-contract-npm.yml)

[![GitHub stars](https://img.shields.io/github/stars/tobenot/Basic-Web-Game-Backend?style=social)](https://github.com/tobenot/Basic-Web-Game-Backend/stargazers)
[![GitHub forks](https://img.shields.io/github/forks/tobenot/Basic-Web-Game-Backend?style=social)](https://github.com/tobenot/Basic-Web-Game-Backend/forks)
[![GitHub issues](https://img.shields.io/github/issues/tobenot/Basic-Web-Game-Backend?style=social)](https://github.com/tobenot/Basic-Web-Game-Backend/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/tobenot/Basic-Web-Game-Backend?style=social)](https://github.com/tobenot/Basic-Web-Game-Backend/pulls)

A modern, type-safe backend for web games — authentication, an OpenAI-compatible LLM proxy, and a publishable TypeScript API contract, all in one Fastify server.

## Table of Contents

- [✨ Features](#-features)
- [🛠 Tech Stack](#-tech-stack)
- [🚀 Quick Start](#-quick-start)
- [📖 API Reference](#-api-reference)
- [🗄 Database Schema](#-database-schema)
- [📦 Publishing the API Contract](#-publishing-the-api-contract)
- [🌐 Deployment](#-deployment)
- [📁 Project Structure](#-project-structure)
- [🤝 Contributing](#-contributing)
- [📄 License](#-license)

## ✨ Features

- 🔐 **Passwordless authentication** — one email carries both a magic link and a one-time code (OTP). Tokens are stored hashed (SHA-256) with TTLs, consumption flags, and OTP attempt limiting.
- 🔑 **JWT sessions** — stateless sessions; the `amr` claim records how the user signed in (`magic_link` vs `otp`).
- 🤖 **OpenAI-compatible LLM proxy** — `POST /v1/chat/completions` with multi-provider routing (Gemini, DeepSeek, OpenAI, OpenRouter), SSE streaming, and separate reasoning/content deltas.
- 🛡 **Feature passwords** — gate LLM access per provider behind shared keys via the `x-feature-password` header.
- 🧱 **End-to-end type safety** — tRPC with Zod input validation from server to frontend.
- 🗄 **Prisma ORM** — PostgreSQL in production, SQLite for local development, versioned migrations.
- 🌐 **Flexible CORS** — allow-list of dev/prod origins (including itch.io for web games), configurable via env, or offloaded to NGINX.
- 📦 **Publishable contract package** — ship your `AppRouter` types as an npm package so the frontend types always match the API.
- ☁️ **Deployment-ready** — Vercel config, Docker Compose for Postgres, and pre-packaged Windows/Linux builds.

## 🛠 Tech Stack

| Layer | Technology |
| ----- | ---------- |
| Runtime | Node.js 22+ |
| Language | TypeScript |
| Framework | Fastify 5 |
| API | tRPC 11 + Zod |
| Database | Prisma 6 (PostgreSQL / SQLite) |
| Auth | JWT + Magic link + OTP |
| Email | Resend |
| AI proxy | OpenAI-compatible (Gemini / DeepSeek / OpenAI / OpenRouter) |

## 🚀 Quick Start

### Prerequisites

- Node.js 22+ (`cat .nvmrc` / `.nvmrc` pins `22`)
- npm
- A database: **SQLite** for local dev, **PostgreSQL** for production

### Install & Run

```bash
# 1. Clone
git clone https://github.com/tobenot/Basic-Web-Game-Backend.git
cd Basic-Web-Game-Backend

# 2. Install dependencies
npm install

# 3. Configure environment variables
cp .env.example .env

# 4. Generate the Prisma schema + client and run migrations
npm run migrate:dev

# 5. Start the dev server
npm run dev
```

The server starts on `http://localhost:3000`. A test page is served at `http://localhost:3000/test.html`.

### Environment Variables

| Variable | Description | Default |
| -------- | ----------- | ------- |
| `DATABASE_URL` | Prisma connection string | — |
| `AUTH_ENABLED` | Master switch for auth | `true` |
| `TRPC_AUTH_REQUIRED` | Require login for protected tRPC procedures | `true` |
| `AI_AUTH_REQUIRED` | Require login for the LLM proxy | `false` |
| `JWT_SECRET` | Secret used to sign session JWTs | — |
| `JWT_EXPIRY` | Session lifetime | `7d` |
| `RESEND_API_KEY` | Resend API key for sending login emails | — |
| `EMAIL_FROM` / `EMAIL_FROM_NAME` | Sender address/name | — |
| `PORT` / `HOST` | Server bind address | `3000` / `localhost` |
| `FRONTEND_LOCAL_URL` | Local frontend base for magic links | `http://localhost:5173` |
| `FRONTEND_PRODUCTION_URL` | Production frontend base for magic links | — |
| `BACKEND_LOCAL_URL` / `BACKEND_PRODUCTION_URL` | Backend URL used for links/logs | — |
| `CORS_ENABLED` | Enable the CORS plugin | `true` |
| `CORS_ADDITIONAL_ORIGINS` | Comma-separated extra allowed origins | — |
| `CORS_PROVIDER` | Set to `NGINX` to let NGINX handle CORS | — |
| `OPENAI_API_KEY` / `DEEPSEEK_API_KEY` / `OPENROUTER_API_KEY` | Upstream LLM keys | — |
| `FEATURE_PASSWORD_ENABLED` | Enable feature-password gating | `false` |
| `FEATURE_PASSWORDS` | `name:scopes` pairs, e.g. `admin-key:llm-all` | — |
| `AUTH_MAGIC_TTL_SEC` / `AUTH_OTP_TTL_SEC` | Magic link / OTP lifetime | `900` / `600` |
| `AUTH_OTP_LENGTH` / `AUTH_OTP_MAX_ATTEMPTS` | OTP digits / max attempts | `6` / `5` |

## 📖 API Reference

All endpoints are mounted under the Fastify server. tRPC procedures live at `/api/trpc/<router>.<procedure>`.

### Health

```
GET /health   → { "status": "ok" }
```

### Authentication flow

1. **Request a login** — creates (or upserts) the user and emails both a magic link and an OTP in one message.
2. **Verify** — the frontend either follows the magic link (`verifyMagicToken`) or accepts the OTP (`verifyEmailCode`).
3. **Authenticated requests** — send the returned JWT as `Authorization: Bearer <token>`.

| Procedure | Type | Input | Output |
| --------- | ---- | ----- | ------ |
| `auth.healthCheck` | query | — | `{ status, timestamp, message }` |
| `auth.requestLoginLink` | mutation | `{ email }` | `{ success, challengeId }` |
| `auth.verifyMagicToken` | mutation | `{ token }` | `{ sessionToken }` |
| `auth.verifyEmailCode` | mutation | `{ challengeId, code }` | `{ sessionToken }` |
| `user.getMe` | query · 🔒 | — | `{ id, email, createdAt }` |
| `announcement.getAnnouncement` | query | — | `{ announcement }` |

> Magic links are built from the frontend URL (`FRONTEND_LOCAL_URL` / `FRONTEND_PRODUCTION_URL`); when it contains a hash route, the `token` query parameter is inserted before the `#` so a hash-router can still read it.

### Example: request a login link

```bash
curl -X POST 'http://localhost:3000/api/trpc/auth.requestLoginLink?batch=1' \
  -H 'Content-Type: application/json' \
  -d '{"0":{"json":{"email":"player@example.com"}}}'
```

### LLM Proxy (OpenAI-compatible)

```
POST /v1/chat/completions
POST /api/v1/chat/completions
```

Accepts standard OpenAI request bodies (`model`, `messages`, `stream`) and routes by model prefix:

| Prefix | Provider | Requires env |
| ------ | -------- | ------------ |
| `gemini-*` | Google Gemini | `GEMINI_API_KEY` |
| `deepseek/*`, `deepseek-*` | DeepSeek | `DEEPSEEK_API_KEY` |
| `openai/*` | OpenAI | `OPENAI_API_KEY` |
| `openrouter/*` | OpenRouter | `OPENROUTER_API_KEY` |
| anything else | Default OpenAI-compatible client | — |

Streaming:

- Set `"stream": true` to receive **Server-Sent Events** with OpenAI `chat.completion.chunk` payloads.
- Reasoning models emit `delta.reasoning_content` separately from `delta.content`. Add `?reasoning_to_content=1` to fold reasoning into `content` instead.
- Aborting the client request aborts the upstream call.

Access control (checked in order):

1. If `AI_AUTH_REQUIRED=true`, a valid JWT (`Authorization: Bearer …`) is required.
2. If `FEATURE_PASSWORD_ENABLED=true`, the request must present an `x-feature-password` header whose scope covers the requested provider (e.g. `admin-key:llm-all`, `marketing-key:llm-gemini`).

### Debug routers

`corsDebug.*` and `echo.*` are small utilities for testing CORS and routing while developing.

## 🗄 Database Schema

Models are defined in `prisma/schema.prisma.template` and generated into `schema.prisma` by the `generate-prisma-schema` script (per-env `DATABASE_URL`).

| Model | Purpose |
| ----- | ------- |
| `User` | Players; identified by unique email |
| `LoginChallenge` | One email/login attempt: hashed magic token **and** hashed OTP, TTL, attempt counter, consumed flag |
| `AuthToken` | Legacy one-time token (kept for backward compatibility) |

## 📦 Publishing the API Contract

The backend ships its `AppRouter` types to the frontend as an npm package, so the two never drift.

### To npm (public)

Run the **Update Version** workflow (choose `patch` / `minor` / `major`), which bumps the version, commits it, and triggers **Publish API Contract to npm**:

```bash
npm view @tobenot/basic-web-game-backend-contract version
```

Frontend install:

```bash
npm i @tobenot/basic-web-game-backend-contract
# or: yarn add @tobenot/basic-web-game-backend-contract
```

### Manual publish (backup path)

```bash
npm run build
npm version patch --no-git-tag-version
npm run publish   # npm publish --access public --registry=https://registry.npmjs.org
```

## 🌐 Deployment

- **Vercel** — `vercel.json` is configured for serverless deployment; the `vercel-build` script handles the build.
- **Nginx** — sample configs live in [`Nginx/`](Nginx) (CORS can be offloaded here with `CORS_PROVIDER=NGINX`).
- **PostgreSQL via Docker** — `docker compose -f docker-compose.postgres.yml up -d`, then use the `:pg` npm scripts (`migrate:pg:dev`, `studio:pg`, …).
- **Self-hosting packages** — `npm run pack:win` / `pack:linux` produce ready-to-run server bundles.

## 📁 Project Structure

```
src/
├── app.ts                    # Fastify server + tRPC mount + CORS
├── server.ts                 # Entry point
├── config.ts                 # Central env config
├── db.ts                     # Prisma client
├── trpc.ts                   # tRPC instance + protected middleware
├── framework/
│   ├── routers/              # auth, user, announcement, llm-proxy, echo, cors-debug
│   ├── utils/                # llm-client, gemini-client, http-proxy, cors-test
│   └── templates/            # Email templates
├── middleware/               # auth, cors, feature-passwords
├── config/                   # auth / cors / feature-passwords config
└── ai/                       # AI service & request queue
```

## 🤝 Contributing

Contributions are welcome! Please read:

- **[CONTRIBUTING.md](CONTRIBUTING.md)** — how to set up, branch, test, and open a PR.
- **[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)** — the standards we expect from the community.
- **[SECURITY.md](SECURITY.md)** — how to report a vulnerability.

Before submitting, please open an issue to discuss significant changes, and keep PRs focused. Templates for [bug reports](.github/ISSUE_TEMPLATE/bug_report.yml) and [feature requests](.github/ISSUE_TEMPLATE/feature_request.yml) are provided.

## 📄 License

Distributed under the **MIT License**. See [LICENSE](LICENSE) for details.

---

**Made with ❤️ by [tobenot](https://github.com/tobenot)**

*An independent open-source effort to provide a solid foundation for web game backends.*
