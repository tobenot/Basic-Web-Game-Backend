# Gemini API 示例集合

这个文件夹包含了使用部署在 `tyo.tobenot.top` 的 Gemini API 的完整示例和工具。

## 📁 文件结构

```
gemini-examples/
├── README.md                    # 本文件
├── gemini-client.js             # JavaScript 客户端库
├── gemini-frontend-example.html # 完整的前端示例页面
├── gemini-usage-example.html   # 使用示例和测试页面
├── gemini-node-example.js      # Node.js 环境使用示例
├── test-gemini-api.js          # API 连接测试脚本
└── quick-test.html             # 快速测试页面
```

## 🚀 快速开始

### 1. 快速测试
在浏览器中打开 `quick-test.html` 来测试 API 连接：
```bash
# 在浏览器中打开
open gemini-examples/quick-test.html
```

### 2. 完整示例
查看完整的前端示例：
```bash
# 在浏览器中打开
open gemini-examples/gemini-frontend-example.html
```

### 3. 使用示例
查看各种使用方式：
```bash
# 在浏览器中打开
open gemini-examples/gemini-usage-example.html
```

### 4. Node.js 测试
运行 Node.js 测试脚本：
```bash
cd gemini-examples
node test-gemini-api.js
```

## 📋 文件说明

### `gemini-client.js`
JavaScript 客户端库，提供简单的 API 接口：
- 支持普通请求和流式响应
- 包含对话会话管理功能
- 兼容浏览器和 Node.js 环境

### `gemini-frontend-example.html`
完整的前端示例页面：
- 现代化的 UI 设计
- 支持普通请求和流式请求
- 包含模型选择、温度控制等参数
- 实时状态显示和错误处理

### `gemini-usage-example.html`
使用示例和测试页面：
- 展示各种使用方式
- 包含实时聊天界面
- 提供代码示例和测试功能

### `gemini-node-example.js`
Node.js 环境使用示例：
- 服务器端使用示例
- 包含完整的测试用例
- 展示不同模型的使用

### `test-gemini-api.js`
API 连接测试脚本：
- 全面的连接测试
- 健康检查、功能测试、CORS 测试
- 详细的错误诊断

### `quick-test.html`
快速测试页面：
- 简单的连接测试
- 实时结果显示
- 适合快速验证 API 状态

## 🔧 API 配置

### 基础 URL
```
https://tyo.tobenot.top
```

### 支持的模型
- `gemini-1.5-pro` (推荐)
- `gemini-1.5-flash` (快速)
- `gemini-1.0-pro`

### 认证
服务器端需要设置 `GEMINI_API_KEY` 环境变量。前端不需要提供 API 密钥。

## 💡 使用建议

1. **首次使用**: 先运行 `quick-test.html` 验证连接
2. **开发阶段**: 使用 `gemini-usage-example.html` 进行功能测试
3. **生产环境**: 参考 `gemini-frontend-example.html` 的设计
4. **服务器端**: 使用 `gemini-node-example.js` 作为参考

## 🚨 注意事项

1. **网络连接**: 确保域名 `tyo.tobenot.top` 可以正常解析
2. **认证**: 基本聊天功能需要用户登录
3. **CORS**: 确保前端域名在服务器的 CORS 允许列表中
4. **错误处理**: 始终使用 try-catch 包装 API 调用

## 📞 支持

如果遇到问题：
1. 检查网络连接
2. 运行 `quick-test.html` 进行诊断
3. 查看浏览器控制台的错误信息
4. 确认服务器配置正确

---

**注意**: 所有示例都使用正确的域名 `tyo.tobenot.top`。