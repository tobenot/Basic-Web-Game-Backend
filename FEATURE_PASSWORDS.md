# 功能密码系统说明

本系统提供了一个可选的、基于密码的权限控制层，用于保护后端特定功能的接口。

## 快速上手

1.  **设置环境变量**：在您的 `.env` 文件中，添加 `FEATURE_PASSWORDS` 变量。
    *   **示例**：`FEATURE_PASSWORDS="my-secret-pwd:llm-all;gemini-user:llm-gemini;deepseek-only:llm-deepseek"`
2.  **重启服务**：为了让环境变量生效，您需要重启后端服务。
3.  **发起请求**：在调用受保护的API时，在HTTP请求头中添加 `X-Feature-Password` 字段，值为您配置的密码。
    *   **示例 (使用 `curl`)**：
        ```bash
        curl -X POST \
             -H "Content-Type: application/json" \
             -H "X-Feature-Password: my-secret-pwd" \
             -d '{ "model": "gemini-pro", "messages": [{"role": "user", "content": "Hello"}] }' \
             http://localhost:3000/api/v1/chat/completions
        ```

---

## 详细配置

### 1. 密码与权限配置 (`FEATURE_PASSWORDS`)

通过 `FEATURE_PASSWORDS` 环境变量来配置密码及其对应的权限。

-   **格式**: `密码1:权限A,权限B;密码2:权限C`
-   每个条目由 `密码:权限列表` 组成。
-   多个条目之间用分号 `;` 隔开。
-   一个密码可以拥有多个权限，权限之间用逗号 `,` 隔开。

**示例 (`.env` 文件中)**:

```env
FEATURE_PASSWORDS="admin-key:llm-all,admin-panel;marketing-key:llm-gemini;dev-key:llm-deepseek"
```

此示例配置了三个密码：
-   `admin-key`：拥有 `llm-all` (所有大模型) 和 `admin-panel` 权限。
-   `marketing-key`：拥有 `llm-gemini` 权限，只能访问 Gemini 模型。
-   `dev-key`：拥有 `llm-deepseek` 权限，只能访问 Deepseek 模型。

### 2. 全局开关 (`FEATURE_PASSWORD_ENABLED`)

您可以通过 `FEATURE_PASSWORD_ENABLED` 环境变量来全局启用或禁用密码校验功能。

-   **禁用校验**: 在 `.env` 文件中设置 `FEATURE_PASSWORD_ENABLED=false`。
    -   设置后，即使 `FEATURE_PASSWORDS` 中有配置，所有请求也将无需密码直接通过。
    *   **示例 (`.env` 文件中)**:
        ```env
        FEATURE_PASSWORD_ENABLED=false
        ```
-   **启用校验**: 不设置该变量，或将其设置为 `true`。
    -   系统将根据 `FEATURE_PASSWORDS` 的配置进行权限校验。
    *   **示例 (`.env` 文件中)**:
        ```env
        FEATURE_PASSWORD_ENABLED=true
        ```

这个开关非常适合在开发和生产环境之间快速切换，或者临时开放接口访问权限。

### 3. 前端接入指南

#### 3.1 基本设置

- **请求头设置**：在所有受保护的API请求中添加 `X-Feature-Password` 头
- **错误处理**：当密码无效或权限不足时，会返回 403 状态码
- **错误响应格式**：
  ```json
  {
    "error": {
      "message": "A valid feature password is required for this operation.",
      "type": "permission_error", 
      "code": "invalid_feature_password"
    }
  }
  ```

#### 3.2 JavaScript/TypeScript 示例

**普通请求示例**：
```typescript
// 设置功能密码
const featurePassword = "admin"; // 从配置或用户输入获取

// 发起请求
const response = await fetch("/api/v1/chat/completions", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Feature-Password": featurePassword
  },
  body: JSON.stringify({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: "Hello" }],
    stream: false
  })
});

if (response.status === 403) {
  const error = await response.json();
  console.error("权限错误:", error.error.message);
  // 处理权限错误，如提示用户输入正确密码
  return;
}

if (!response.ok) {
  console.error("请求失败:", response.status);
  return;
}

const result = await response.json();
console.log("AI回复:", result);
```

**流式请求示例**：
```typescript
const response = await fetch("/api/v1/chat/completions", {
  method: "POST", 
  headers: {
    "Content-Type": "application/json",
    "X-Feature-Password": featurePassword
  },
  body: JSON.stringify({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: "Hello" }],
    stream: true
  })
});

if (response.status === 403) {
  const error = await response.json();
  console.error("权限错误:", error.error.message);
  return;
}

const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = line.slice(6);
      if (data === '[DONE]') {
        console.log("流式响应结束");
        return;
      }
      try {
        const parsed = JSON.parse(data);
        console.log("收到数据:", parsed);
      } catch (e) {
        // 忽略解析错误
      }
    }
  }
}
```

**使用 OpenAI SDK**：
```typescript
import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "https://your-host",
  apiKey: "unused-on-server",
  defaultHeaders: {
    "X-Feature-Password": "admin"
  }
});

const res = await client.chat.completions.create({
  model: "deepseek-chat",
  messages: [{ role: "user", content: "hello" }],
  stream: false,
});
```

#### 3.3 错误处理最佳实践

```typescript
class FeaturePasswordError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'FeaturePasswordError';
  }
}

async function makeAuthenticatedRequest(url: string, password: string, data: any) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Feature-Password": password
      },
      body: JSON.stringify(data)
    });

    if (response.status === 403) {
      const error = await response.json();
      throw new FeaturePasswordError(
        error.error.message, 
        error.error.code
      );
    }

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof FeaturePasswordError) {
      // 处理功能密码相关错误
      console.error("密码验证失败:", error.message);
      // 可以在这里提示用户重新输入密码
    } else {
      // 处理其他错误
      console.error("请求失败:", error);
    }
    throw error;
  }
}

// 使用示例
try {
  const result = await makeAuthenticatedRequest(
    "/api/v1/chat/completions",
    "admin",
    {
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: "Hello" }],
      stream: false
    }
  );
  console.log("成功:", result);
} catch (error) {
  // 错误已在 makeAuthenticatedRequest 中处理
}
```

### 4. 如何在代码中扩展

要保护一个新的路由：

1.  **定义权限**: 为您的新功能定义一个唯一的权限字符串，例如 `my-feature-read`。
2.  **应用中间件**: 在创建路由时，应用 `featurePasswordAuth` 中间件，并提供一个函数来指定该路由所需的权限。

**示例代码**:
```typescript
import { FastifyRequest, FastifyInstance, FastifyPluginCallback } from 'fastify';
import { featurePasswordAuth } from '../middleware/feature-passwords';

interface MyFeatureBody {
  action: string;
}

const myFeatureHandler = async (request: FastifyRequest, reply: FastifyReply) => {
  const body = request.body as MyFeatureBody;
  // ... 处理您的功能逻辑 ...
  reply.send({ status: 'success', action: body.action });
};

const getMyFeaturePermission = (request: FastifyRequest): string | null => {
  const body = request.body as MyFeatureBody;
  if (request.method === 'GET') {
    return 'my-feature-read'; // 例如，GET 请求需要 'my-feature-read' 权限
  }
  if (body?.action === 'delete') {
    return 'my-feature-delete'; // 例如，删除操作需要 'my-feature-delete' 权限
  }
  return 'my-feature-write'; // 其他 POST 请求默认为 'my-feature-write' 权限
};

export const myFeatureRoutes: FastifyPluginCallback = (server: FastifyInstance, _opts, done) => {
  server.get('/my-feature', { preHandler: [featurePasswordAuth(getMyFeaturePermission)] }, myFeatureHandler);
  server.post('/my-feature', { preHandler: [featurePasswordAuth(getMyFeaturePermission)] }, myFeatureHandler);
  done();
};
```
