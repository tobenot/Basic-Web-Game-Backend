
---

### **教程：实现前后端类型自动同步（通用版）**

本教程将指导您如何配置您的前端和后端仓库，以实现类型定义的自动同步。我们将使用 **GitHub Packages** 作为私有npm仓库来发布和消费后端的API契约包。

---

## **快速使用指南（简单版）**

如果您已经熟悉流程，可以直接按照以下步骤操作：

### **后端配置**
1. **修改`package.json`**：
   - 将`name`字段改为`@<您的GitHub用户名>/<包名>`（例如：`@yourusername/api-contract`）。
   - 确保`version`字段正确。
   - 添加`"types": "dist/server.d.ts"`和`"files": ["dist"]`。

2. **调整`tsconfig.json`**：
   - 启用`"declaration": true`以生成类型声明文件。

3. **创建GitHub Actions工作流**：
   - 在`.github/workflows/publish-contract.yml`中配置自动发布流程。

4. **推送代码**：
   - 每次推送到`main`分支时，GitHub Actions会自动发布新版本的包。

### **前端配置**
1. **创建`.npmrc`文件**：
   - 添加以下内容：
     ```
     @yourusername:registry=https://npm.pkg.github.com/
     ```
   - 替换`yourusername`为您的GitHub用户名。

2. **登录到GitHub Packages**：
   - 运行：
     ```bash
     npm login --scope=@yourusername --registry=https://npm.pkg.github.com
     ```
   - 输入您的GitHub用户名、个人访问令牌（PAT）和邮箱。

3. **安装契约包**：
   - 运行：
     ```bash
     npm install @yourusername/api-contract@latest
     ```

4. **在代码中使用类型**：
   - 导入类型：
     ```typescript
     import type { AppRouter } from '@yourusername/api-contract';
     ```

---

## **详细教程（完整版）**

### **1. 后端仓库配置**
#### **1.1 修改`package.json`**
确保您的`package.json`包含以下关键字段：
```json
{
  "name": "@yourusername/api-contract", // 替换yourusername为您的GitHub用户名
  "version": "1.0.0",
  "main": "dist/server.js",
  "types": "dist/server.d.ts",
  "files": ["dist"],
  "scripts": {
    "build": "tsc", // 确保有build脚本
    // 其他脚本...
  }
}
```

#### **1.2 调整`tsconfig.json`**
确保`tsconfig.json`启用了类型声明生成：
```json
{
  "compilerOptions": {
    "declaration": true,
    "outDir": "dist"
  }
}
```

#### **1.3 创建GitHub Actions工作流**
在`.github/workflows/publish-contract.yml`中配置以下内容：
```yaml
name: Publish API Contract to GitHub Packages

on:
  push:
    branches: [main]

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          registry-url: 'https://npm.pkg.github.com'
          scope: '@yourusername' # 替换为您的GitHub用户名
      - run: npm ci && npm run build
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

### **2. 前端仓库配置**
#### **2.1 创建个人访问令牌（PAT）**
1. 前往GitHub -> Settings -> Developer settings -> Personal access tokens。
2. 生成一个令牌，勾选`read:packages`权限。
3. 保存令牌（关闭后无法再次查看）。

#### **2.2 配置`.npmrc`**
在前端项目根目录创建`.npmrc`文件：
```
@yourusername:registry=https://npm.pkg.github.com/
```

#### **2.3 登录到GitHub Packages**
运行以下命令：
```bash
npm login --scope=@yourusername --registry=https://npm.pkg.github.com
```
输入：
- **Username**: 您的GitHub用户名。
- **Password**: 您的PAT令牌。
- **Email**: 您的GitHub邮箱。

#### **2.4 安装契约包**
运行：
```bash
npm install @yourusername/api-contract@latest
```

#### **2.5 在代码中使用类型**
```typescript
import type { AppRouter } from '@yourusername/api-contract';
```

---

### **3. 自动化部署（可选）**
如果您的前端使用GitHub Actions部署，确保工作流中配置了读取私有包的权限：
```yaml
jobs:
  deploy:
    permissions:
      packages: read # 添加此行
    steps:
      - uses: actions/setup-node@v4
        with:
          registry-url: 'https://npm.pkg.github.com'
          scope: '@yourusername'
      - run: npm ci
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## **总结**
1. 后端：每次推送到`main`分支时，自动发布新版本的契约包。
2. 前端：通过`.npmrc`和PAT令牌安装最新版本的契约包。
3. 开发：直接导入类型，享受完整的类型安全。

这样，无论您的GitHub用户名是什么，都可以轻松实现前后端类型同步！