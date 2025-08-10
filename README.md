# Basic Web Game Backend

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Fastify](https://img.shields.io/badge/Fastify-000000?logo=fastify&logoColor=white)](https://fastify.io/)
[![tRPC](https://img.shields.io/badge/tRPC-2596BE?logo=trpc&logoColor=white)](https://trpc.io/)
[![Prisma](https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)

A modern, type-safe backend for web games built with Fastify, tRPC, and Prisma. Features secure authentication with magic links and a robust API architecture.

## ✨ Features

- 🔐 **Magic Link Authentication** - Secure, passwordless login system
- 🚀 **Fastify Server** - High-performance Node.js web framework
- 🔗 **tRPC Integration** - End-to-end type safety
- 🗄️ **Prisma ORM** - Type-safe database operations
- 📱 **CORS Support** - Cross-origin resource sharing enabled
- 🎮 **Game-Ready API** - Built specifically for web game backends
- 📊 **User Management** - Complete user lifecycle management
- 📢 **Announcement System** - Built-in announcement functionality

## 🛠️ Tech Stack

- **Runtime**: Node.js
- **Framework**: Fastify
- **API**: tRPC
- **Database**: Prisma ORM (SQLite/PostgreSQL)
- **Language**: TypeScript
- **Authentication**: JWT + Magic Links
- **Email**: Resend

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Database (SQLite for development, PostgreSQL for production)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/tobenot/Basic-Web-Game-Backend.git
   cd Basic-Web-Game-Backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```
   
   Configure your `.env` file:
   ```env
   DATABASE_URL="file:./dev.db"
   JWT_SECRET="your-secret-key"
   RESEND_API_KEY="your-resend-api-key"
   EMAIL_FROM="noreply@sendmail.tobenot.top"
   EMAIL_FROM_NAME="YourApp"
   ```

4. **Generate Prisma schema and run migrations**
   ```bash
   npm run migrate:dev
   ```

5. **Start the development server**
   ```bash
   npm run dev
   ```

The server will be available at `http://localhost:3000`

## 📚 API Documentation

### Authentication Endpoints

- `POST /api/trpc/auth.sendMagicLink` - Send magic link to user email
- `POST /api/trpc/auth.verifyToken` - Verify magic link token
- `GET /api/trpc/auth.me` - Get current user info

Magic link generation:
- Uses frontend URL (`FRONTEND_LOCAL_URL` / `FRONTEND_PRODUCTION_URL`) as base
- Appends `token` as a query param
- If the frontend URL contains a hash route, the query is inserted before the hash so the frontend can read it

### User Management

- `GET /api/trpc/user.profile` - Get user profile
- `PUT /api/trpc/user.update` - Update user information

### Announcements

- `GET /api/trpc.announcement.list` - Get announcement list
- `POST /api/trpc.announcement.create` - Create new announcement

## 🗄️ Database Schema

The application uses Prisma with the following models:

- **User**: Core user information and authentication
- **AuthToken**: Magic link tokens for passwordless authentication

## 🧪 Development

### Available Scripts

```bash
# Development
npm run dev              # Start development server
npm run build           # Build for production
npm run studio          # Open Prisma Studio

# Database
npm run migrate:dev     # Run migrations in development
npm run migrate:prod    # Deploy migrations to production

# Utilities
npm run prisma:generate:schema  # Generate Prisma schema
npm run copy-templates          # Copy template files
```

### 发布到 GitHub Packages

1. 手动触发工作流 `Update Version`，选择 `patch|minor|major`
2. 流水线将提交版本更新，随后自动触发 `Publish API Contract` 完成发布
3. 验证版本：
   ```bash
   npm view @tobenot/basic-web-game-backend-contract version --registry=https://npm.pkg.github.com
   ```
4. 前端安装：
   ```bash
   yarn add @tobenot/basic-web-game-backend-contract@latest
   ```

备用：本地直接发布
```bash
npm login --scope=@tobenot --registry=https://npm.pkg.github.com
npm run build
npm version patch --no-git-tag-version
npm publish --registry=https://npm.pkg.github.com
```

### Project Structure

```
src/
├── ai/               # AI service & queue
│   ├── AiService.ts
│   ├── AiRequestQueueService.ts
│   └── types.ts
├── routers/          # tRPC/Fastify routers
│   ├── auth.ts
│   ├── user.ts
│   ├── announcement.ts
│   └── llm-proxy.ts
├── utils/            # Utilities (e.g. LLM upstream client)
│   └── llm-client.ts
├── templates/        # Email templates
├── server.ts         # Fastify server setup
└── trpc.ts           # tRPC configuration
```

## 🚀 Deployment

### Vercel Deployment

This project is configured for Vercel deployment. The `vercel.json` file contains the necessary configuration.

### Environment Variables for Production

```env
DATABASE_URL="postgresql://..."
JWT_SECRET="your-production-secret"
RESEND_API_KEY="your-resend-api-key"
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Guidelines

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [Fastify](https://fastify.io/) for high-performance web applications
- Powered by [tRPC](https://trpc.io/) for end-to-end type safety
- Database management with [Prisma](https://www.prisma.io/)
- Email delivery via [Resend](https://resend.com/)

## 📞 Support

If you have any questions or need help, please:

- Open an [issue](https://github.com/tobenot/Basic-Web-Game-Backend/issues)
- Check the [documentation](https://github.com/tobenot/Basic-Web-Game-Backend#readme)

---

**Made with ❤️ by [tobenot](https://github.com/tobenot)**

*This project is maintained as an independent open-source effort to provide a solid foundation for web game backends.*

## Template Updates

- Use the bundled script to preview/apply template updates:
  - Preview latest: `bash scripts/update-from-template.sh`
  - Apply a specific tag with backup: `APPLY=1 bash scripts/update-from-template.sh vX.Y.Z`
- The template source and version are recorded in `template.lock`.
- Install a non-blocking pre-commit reminder:
  ```bash
  bash scripts/install-git-hooks.sh
  ```
- Controlled areas (prefer updating via template): `.github/`, `scripts/`, `src/framework/`, template-marked blocks in `src/server.ts`, `tsconfig.json`, `vercel.json`, and docs listed in `MIGRATION.md`.