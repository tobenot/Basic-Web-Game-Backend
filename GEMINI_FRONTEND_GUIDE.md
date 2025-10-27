# Gemini API 前端使用指南

这个项目提供了使用部署在 `tyo.tobenot.top` 的 Gemini API 的完整前端解决方案。

## 📁 文件说明

- `gemini-frontend-example.html` - 完整的 Gemini API 前端示例页面
- `gemini-client.js` - JavaScript 客户端库
- `gemini-usage-example.html` - 使用示例和测试页面
- `gemini-node-example.js` - Node.js 环境使用示例
- `test-gemini-api.js` - API 连接测试脚本

## 🚀 快速开始

### 1. 基本使用

```html
<!DOCTYPE html>
<html>
<head>
    <title>Gemini API 示例</title>
</head>
<body>
    <!-- 引入客户端库 -->
    <script src="gemini-client.js"></script>
    
    <script>
        // 创建客户端实例
        const client = new GeminiClient({
            baseUrl: 'https://tyo.tobenot.top',
            defaultModel: 'gemini-1.5-pro'
        });

        // 发送消息
        async function sendMessage() {
            try {
                const response = await client.sendMessage('你好！');
                console.log('AI 回复:', response);
            } catch (error) {
                console.error('错误:', error.message);
            }
        }

        // 调用函数
        sendMessage();
    </script>
</body>
</html>
```

### 2. 流式响应

```javascript
// 流式发送消息
await client.sendMessageStream('请写一首诗', (chunk, fullContent) => {
    console.log('收到数据块:', chunk);
    console.log('完整内容:', fullContent);
});
```

### 3. 对话会话

```javascript
// 创建对话会话
const conversation = client.createConversation();

// 添加系统消息
conversation.addSystemMessage('你是一个友好的助手，请用中文回答。');

// 发送消息并保持对话历史
const reply1 = await conversation.sendMessage('你好！');
const reply2 = await conversation.sendMessage('我刚才说了什么？');
```

## 🔧 API 配置

### 支持的模型

- `gemini-1.5-pro` (推荐)
- `gemini-1.5-flash` (快速)
- `gemini-1.0-pro`

### 客户端选项

```javascript
const client = new GeminiClient({
    baseUrl: 'https://tyo.tobenot.top',        // API 基础 URL
    defaultModel: 'gemini-1.5-pro',           // 默认模型
    defaultTemperature: 0.7,                  // 默认温度 (0.0-1.0)
    defaultMaxTokens: 2000                    // 默认最大令牌数
});
```

### 请求参数

```javascript
const response = await client.chat({
    messages: [
        { role: 'user', content: '你好！' }
    ],
    model: 'gemini-1.5-pro',     // 可选，默认使用客户端设置
    temperature: 0.7,             // 可选，控制创造性
    maxTokens: 2000,              // 可选，最大输出长度
    stream: false                 // 可选，是否使用流式响应
});
```

## 📝 消息格式

### 消息对象结构

```javascript
{
    role: 'user' | 'assistant' | 'system',  // 消息角色
    content: '消息内容'                      // 消息内容
}
```

### 示例对话

```javascript
const messages = [
    { role: 'system', content: '你是一个有用的助手。' },
    { role: 'user', content: '你好！' },
    { role: 'assistant', content: '你好！有什么我可以帮助你的吗？' },
    { role: 'user', content: '请介绍一下你自己。' }
];
```

## 🔄 流式响应处理

### 基本流式请求

```javascript
await client.sendMessageStream('请写一首诗', (chunk, fullContent) => {
    // chunk: 当前数据块
    // fullContent: 到目前为止的完整内容
    console.log('收到:', chunk);
    console.log('完整内容:', fullContent);
});
```

### 在网页中显示流式响应

```javascript
const outputDiv = document.getElementById('output');

await client.sendMessageStream('请写一首诗', (chunk, fullContent) => {
    outputDiv.textContent = fullContent;
});
```

## 💬 对话会话管理

### 创建会话

```javascript
const conversation = client.createConversation();
```

### 添加消息

```javascript
conversation.addSystemMessage('你是一个友好的助手。');
conversation.addUserMessage('你好！');
conversation.addAssistantMessage('你好！有什么可以帮助你的吗？');
```

### 发送消息

```javascript
const reply = await conversation.sendMessage('请介绍一下你自己。');
console.log(reply);
```

### 流式发送消息

```javascript
await conversation.sendMessageStream('请写一首诗', (chunk, fullContent) => {
    console.log('收到:', chunk);
});
```

### 管理对话历史

```javascript
// 获取所有消息
const messages = conversation.getMessages();

// 清空对话历史
conversation.clear();
```

## 🛠️ 错误处理

### 基本错误处理

```javascript
try {
    const response = await client.sendMessage('你好！');
    console.log(response);
} catch (error) {
    console.error('请求失败:', error.message);
    
    if (error.message.includes('HTTP 401')) {
        console.error('认证失败，请检查 API 密钥');
    } else if (error.message.includes('HTTP 429')) {
        console.error('请求过于频繁，请稍后再试');
    } else if (error.message.includes('HTTP 500')) {
        console.error('服务器内部错误');
    } else if (error.message.includes('fetch failed')) {
        console.error('网络连接失败，请检查网络连接和域名解析');
    }
}
```

### 网络错误处理

```javascript
try {
    const response = await client.sendMessage('你好！');
    console.log(response);
} catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.error('网络连接失败，请检查网络连接');
    } else {
        console.error('未知错误:', error);
    }
}
```

## 🌐 CORS 配置

如果你的前端应用运行在不同的域名下，确保服务器已正确配置 CORS。服务器支持以下域名：

- `https://tyo.tobenot.top`
- `https://tobenot.top`
- `http://localhost:5173` (开发环境)
- `http://127.0.0.1:5173` (开发环境)

## 🔐 认证

服务器需要设置 `GEMINI_API_KEY` 环境变量来访问 Gemini API。前端不需要提供 API 密钥，所有认证都在服务器端处理。

## 📱 浏览器兼容性

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

需要支持以下 Web API：
- `fetch()`
- `ReadableStream`
- `TextDecoder`
- `AbortController`

## 🚨 注意事项

1. **请求频率限制**: 避免过于频繁的请求，建议在请求之间添加适当的延迟。

2. **错误处理**: 始终使用 try-catch 包装 API 调用。

3. **流式响应**: 流式响应需要正确处理数据块，确保在连接关闭时释放资源。

4. **对话历史**: 长时间对话可能会消耗大量令牌，建议定期清理对话历史。

5. **网络连接**: 确保网络连接稳定，特别是在使用流式响应时。

6. **域名解析**: 如果遇到连接问题，请检查域名 `tyo.tobenot.top` 是否可以正常解析。

## 🔧 故障排除

### 常见问题

1. **网络连接失败**
   - 检查网络连接是否正常
   - 确认域名 `tyo.tobenot.top` 可以正常解析
   - 尝试使用其他网络环境

2. **CORS 错误**
   - 确认前端域名在服务器的 CORS 允许列表中
   - 检查浏览器控制台的错误信息

3. **认证失败**
   - 确认服务器已正确设置 `GEMINI_API_KEY` 环境变量
   - 检查 API 密钥是否有效

4. **请求超时**
   - 增加请求超时时间
   - 检查网络延迟

### 测试连接

使用提供的测试脚本检查 API 连接：

```bash
# 在浏览器中打开测试页面
open gemini-frontend-example.html

# 或者运行 Node.js 测试脚本
node test-gemini-api.js
```

## 📞 支持

如果遇到问题，请检查：

1. 网络连接是否正常
2. 服务器是否正常运行 (`https://tyo.tobenot.top/health`)
3. 浏览器控制台是否有错误信息
4. 请求参数是否正确
5. 域名解析是否正常

## 📄 许可证

本项目遵循 ISC 许可证。