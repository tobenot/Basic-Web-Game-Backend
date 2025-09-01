/**
 * Node.js 环境下的 Gemini API 使用示例
 * 需要先安装 node-fetch: npm install node-fetch
 */

// 如果使用 Node.js 18+，可以直接使用内置的 fetch
// 如果使用较老版本，需要安装 node-fetch
// const fetch = require('node-fetch');

class GeminiClientNode {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || 'https://tyo.tobenot.top';
        this.defaultModel = options.defaultModel || 'gemini-1.5-pro';
        this.defaultTemperature = options.defaultTemperature || 0.7;
        this.defaultMaxTokens = options.defaultMaxTokens || 2000;
    }

    /**
     * 发送聊天完成请求
     */
    async chat(options) {
        const {
            messages,
            model = this.defaultModel,
            temperature = this.defaultTemperature,
            maxTokens = this.defaultMaxTokens,
            stream = false
        } = options;

        if (!messages || !Array.isArray(messages)) {
            throw new Error('messages 参数是必需的，且必须是数组');
        }

        const requestBody = {
            model,
            messages,
            temperature,
            max_tokens: maxTokens,
            stream
        };

        const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        if (stream) {
            return response.body;
        } else {
            return await response.json();
        }
    }

    /**
     * 发送简单消息并获取回复
     */
    async sendMessage(message, options = {}) {
        const response = await this.chat({
            messages: [{ role: 'user', content: message }],
            ...options
        });

        if (response.choices && response.choices.length > 0) {
            return response.choices[0].message.content;
        } else {
            throw new Error('响应中没有找到内容');
        }
    }

    /**
     * 流式发送消息
     */
    async sendMessageStream(message, onChunk, options = {}) {
        const stream = await this.chat({
            messages: [{ role: 'user', content: message }],
            stream: true,
            ...options
        });

        if (!stream) {
            throw new Error('无法获取流式响应');
        }

        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') {
                            return;
                        }
                        
                        try {
                            const json = JSON.parse(data);
                            const content = json.choices?.[0]?.delta?.content;
                            if (content) {
                                fullContent += content;
                                onChunk(content, fullContent);
                            }
                        } catch (e) {
                            // 忽略解析错误
                        }
                    }
                }
            }
        } finally {
            reader.releaseLock();
        }
    }
}

// 使用示例
async function main() {
    const client = new GeminiClientNode({
        baseUrl: 'https://tyo.tobenot.top',
        defaultModel: 'gemini-1.5-pro'
    });

    console.log('🤖 Gemini API Node.js 示例\n');

    try {
        // 1. 基本消息发送
        console.log('1. 发送基本消息...');
        const response = await client.sendMessage('你好！请简单介绍一下你自己。');
        console.log('AI 回复:', response);
        console.log('');

        // 2. 流式响应
        console.log('2. 流式响应示例...');
        await client.sendMessageStream('请写一首关于春天的短诗', (chunk, fullContent) => {
            process.stdout.write(chunk);
        });
        console.log('\n');

        // 3. 复杂对话
        console.log('3. 复杂对话示例...');
        const messages = [
            { role: 'system', content: '你是一个专业的编程助手，请用中文回答。' },
            { role: 'user', content: '请解释一下什么是 RESTful API？' }
        ];

        const complexResponse = await client.chat({ messages });
        console.log('AI 回复:', complexResponse.choices[0].message.content);
        console.log('');

        // 4. 不同模型的比较
        console.log('4. 不同模型的比较...');
        const models = ['gemini-1.5-pro', 'gemini-1.5-flash'];
        
        for (const model of models) {
            console.log(`\n使用模型: ${model}`);
            const modelResponse = await client.sendMessage('请用一句话介绍你自己', { model });
            console.log(`回复: ${modelResponse}`);
        }

    } catch (error) {
        console.error('❌ 错误:', error.message);
    }
}

// 如果直接运行此文件
if (require.main === module) {
    main().catch(console.error);
}

// 导出类
module.exports = { GeminiClientNode };