# 后端架构设计

## 1\. 引言与设计理念

### 目的

本文档旨在为构建现代化、可扩展且类型安全的后端提供架构理念和推荐技术栈，以补充 “Carrot Web Game Template”。其主要目标是创建一个优先考虑**开发者体验**和**强大性能**的蓝图。

### 核心原则

  - **端到端的类型安全**：通过确保类型从数据库无缝流向后端，并一直延伸到前端的 React 组件，来消除一大类运行时错误。你在数据库中查询什么，就能保证在客户端得到什么。
  - **高性能**：利用低开销、高吞吐量的 Web 框架高效处理请求，确保后端永远不会成为瓶颈。
  - **开发者体验**：最大限度地减少样板代码和手动类型处理。开发过程应该感觉快速、直观、愉快，并拥有出色的自动补全和清晰的错误信息。
  - **模块化与可扩展性**：架构的组织方式应易于理解、维护和扩展，以适应项目的增长。

## 2\. 推荐技术栈

| 层级 | 技术 | 原因 |
|---|---|---|
| **框架** | [**Fastify**](https://www.fastify.io/) | 性能极快，开销极小。其基于插件的架构功能强大，并提供一流的 TypeScript 支持。 |
| **API 层** | [**tRPC**](https://trpc.io/) | 我们类型安全方法的核心。它**无需代码生成**，让你可以像从前端调用本地函数一样编写 API 端点。 |
| **数据库 ORM** | [**Prisma**](https://www.prisma.io/) | 新一代 ORM，可根据你的 schema 提供完全类型安全的数据库客户端。它使数据库查询变得直观和安全。 |
| **数据库** | [**PostgreSQL**](https://www.postgresql.org/) / [**SQLite**](https://www.sqlite.org/index.html) | PostgreSQL 用于生产环境的稳健性；SQLite 用于零配置、基于文件的本地开发和简单原型。Prisma 无缝支持这两种数据库。 |

## 3\. 数据流图

此图说明了数据和类型如何在整个技术栈中流动，从而创建了一个统一、连贯的系统。

```mermaid
 graph TD
     subgraph "💻 前端 (你的 React 应用)"
         A[React 组件] --> B{tRPC 客户端};
     end

     subgraph "🚀 后端 (Fastify 服务器)"
         B --"HTTP 请求"--> C[Fastify 适配器];
         C --> D[tRPC 路由];
         D --"调用过程"--> E[服务/逻辑];
     end
     
     subgraph "💾 数据库"
         E --"数据库查询"--> F[Prisma 客户端];
         F --"SQL"--> G[(PostgreSQL/SQLite)];
         G --"数据"--> F;
         F --"类型化结果"--> E;
     end

     E --"类型化响应"--> D;
     D --"JSON 响应"--> C;
     C --"类型自动推断"--> B;
     B --"完全类型化的数据与钩子"--> A;

     linkStyle 1 stroke:#2980b9,stroke-width:2px;
     linkStyle 2 stroke:#2980b9,stroke-width:2px;
     linkStyle 3 stroke:#27ae60,stroke-width:2px;
     linkStyle 8 stroke:#27ae60,stroke-width:2px;
     linkStyle 9 stroke:#2980b9,stroke-width:2px;
     linkStyle 10 stroke:#2980b9,stroke-width:2px;
     
     style A fill:#ecf0f1,stroke:#34495e;
     style B fill:#3498db,stroke:#2980b9,color:#fff;
     style C fill:#9b59b6,stroke:#8e44ad,color:#fff;
     style D fill:#e67e22,stroke:#d35400,color:#fff;
     style E fill:#ecf0f1,stroke:#34495e;
     style F fill:#1abc9c,stroke:#16a085,color:#fff;
     style G fill:#f1c40f,stroke:#f39c12;
```

-----

-----
