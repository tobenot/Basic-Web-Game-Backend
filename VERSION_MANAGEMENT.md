# 版本管理说明

## 问题背景

之前的GitHub Action会在每次推送到main分支时自动更新版本号并发布，这会导致：
1. 循环触发Vercel构建
2. 每次提交后都需要拉取最新代码
3. 不必要的版本更新

## 新的版本管理方式

### 1. 本地版本更新

您可以在本地使用以下命令来更新版本号：

```bash
# 更新补丁版本 (1.0.10 -> 1.0.11)
npm run version:patch

# 更新次要版本 (1.0.10 -> 1.1.0)
npm run version:minor

# 更新主要版本 (1.0.10 -> 2.0.0)
npm run version:major

# 查看下一个版本号（不更新文件）
npm run get-next-version
```

### 2. 手动触发版本更新

在GitHub仓库的Actions页面，您可以手动触发"Update Version"工作流：
1. 进入Actions页面
2. 选择"Update Version"工作流
3. 点击"Run workflow"
4. 选择版本类型（patch/minor/major）
5. 点击"Run workflow"

### 3. 版本号获取逻辑

脚本会按以下顺序获取版本号：
1. 首先尝试从npm registry获取最新版本
2. 如果失败，则使用本地package.json中的版本
3. 根据选择的类型（patch/minor/major）计算下一个版本号

### 4. 发布流程

修改后的发布流程：
1. 手动更新版本号（本地或GitHub Action）
2. 推送到main分支
3. 自动触发发布到npm包（不会更新版本号）

### 5. 避免循环触发

- 发布工作流添加了`paths-ignore: ['package.json']`，避免版本更新触发发布
- 版本更新工作流只在手动触发时运行

## 使用建议

1. **开发阶段**：使用本地命令更新版本号
2. **发布阶段**：使用GitHub Action手动触发版本更新
3. **紧急修复**：直接使用`npm run version:patch`快速更新

## 脚本文件

- `scripts/get-next-version.js` - 获取下一个版本号
- `scripts/update-version.js` - 更新package.json中的版本号
- `.github/workflows/update-version.yml` - 手动版本更新工作流
- `.github/workflows/publish-contract.yml` - 发布工作流（已优化）