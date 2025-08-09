
---

### **教程：实现前后端类型自动同步（通用版）**

本教程基于当前仓库的实际配置：使用 **GitHub Packages** 作为私有 npm 仓库，通过两个工作流完成版本更新与自动发布。

---

## **快速使用指南（简单版）**

如果您已经熟悉流程，可以直接按照以下步骤操作：

### **后端配置（已在本仓库就绪）**
1. `package.json`
   - `name`: `@tobenot/basic-web-game-backend-contract`
   - `main`: `dist/server.js`
   - `types`: `dist/server.d.ts`
   - `files`: `["dist", "package.json"]`
2. `tsconfig.json`
   - 已启用 `"declaration": true` 与 `"outDir": "dist"`
3. 工作流
   - `Update Version`：手动触发，递增版本并提交
   - `Publish API Contract`：跟随上一步成功完成后自动发布到 GitHub Packages

### **前端配置**
1. **创建`.npmrc`文件**：
   - 添加以下内容：
     ```
      @tobenot:registry=https://npm.pkg.github.com/
     ```
   - 替换`yourusername`为您的GitHub用户名。

2. **登录到GitHub Packages**：
   - 运行：
     ```bash
      npm login --scope=@tobenot --registry=https://npm.pkg.github.com
     ```
   - 输入您的GitHub用户名、个人访问令牌（PAT）和邮箱。

3. **安装/更新契约包**：
   - 运行：
     ```bash
      yarn add @tobenot/basic-web-game-backend-contract@latest
     # 或者对于已安装的包，仅更新：
     # yarn upgrade @yourusername/api-contract
     ```

4. **在代码中使用类型**：
   - 导入类型：
     ```typescript
      import type { AppRouter } from '@tobenot/basic-web-game-backend-contract';
     ```

---

## **详细教程（完整版）**

### **1. 后端仓库配置**
#### **1.1 `package.json` 关键字段（已配置）**
```json
{
  "name": "@tobenot/basic-web-game-backend-contract",
  "main": "dist/server.js",
  "types": "dist/server.d.ts",
  "files": ["dist", "package.json"]
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

#### **1.3 工作流说明（与本仓库一致）**
- `Update Version`（`.github/workflows/update-version.yml`）
  - 手动触发，选择 `patch|minor|major`
  - 运行 `npm run version:<type>`，提交 `package.json` 变更
- `Publish API Contract`（`.github/workflows/publish-contract.yml`）
  - 监听上一个工作流成功完成
  - 安装与构建
  - 预检 `npm view @tobenot/basic-web-game-backend-contract@<version>` 是否存在
  - 如不存在则 `npm publish --registry=https://npm.pkg.github.com`

---

### **2. 前端仓库配置**
#### **2.1 创建个人访问令牌（PAT）**
1. 前往GitHub -> Settings -> Developer settings -> Personal access tokens。
2. 生成一个令牌，勾选`read:packages`权限。
3. 保存令牌（关闭后无法再次查看）。

#### **2.2 配置`.npmrc`**
在前端项目根目录创建`.npmrc`文件：
```
@tobenot:registry=https://npm.pkg.github.com/
```

#### **2.3 登录到GitHub Packages**
运行以下命令：
```bash
npm login --scope=@tobenot --registry=https://npm.pkg.github.com
```
输入：
- **Username**: 您的GitHub用户名。
- **Password**: 您的PAT令牌。
- **Email**: 您的GitHub邮箱。

#### **2.4 安装/更新契约包**
运行：
```bash
yarn add @yourusername/api-contract@latest
# 或者对于已安装的包，仅更新：
# yarn upgrade @yourusername/api-contract
```

#### **2.5 在代码中使用类型**
```typescript
import type { AppRouter } from '@tobenot/basic-web-game-backend-contract';
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
          scope: '@tobenot'
      - run: npm ci
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## **发布与验证**
1. 触发发布
   - 方式A：在 GitHub Actions 手动运行 `Update Version`，选择递增类型
   - 方式B：本地执行并提交
     ```bash
     npm run version:patch
     git push
     ```
   - 上一步成功后将自动触发 `Publish API Contract` 完成发布
2. 验证
   ```bash
   npm view @tobenot/basic-web-game-backend-contract version --registry=https://npm.pkg.github.com
   ```
3. 前端安装/更新
   ```bash
   yarn add @tobenot/basic-web-game-backend-contract@latest
   # 或
   yarn upgrade @tobenot/basic-web-game-backend-contract
   ```

## **本地手动发布（备用）**
如需跳过 CI 直接发布：
```bash
npm login --scope=@tobenot --registry=https://npm.pkg.github.com
npm run build
npm version patch --no-git-tag-version
npm publish --registry=https://npm.pkg.github.com
```

完成后可用上面的验证命令确认版本。