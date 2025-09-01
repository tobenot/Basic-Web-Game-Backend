/**
 * Gemini API 客户端库
 * 用于与部署在 tko.tobenot.top 的 Gemini API 进行交互
 */
class GeminiClient {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || 'https://tko.tobenot.top';
        this.defaultModel = options.defaultModel || 'gemini-1.5-pro';
        this.defaultTemperature = options.defaultTemperature || 0.7;
        this.defaultMaxTokens = options.defaultMaxTokens || 2000;
    }

    /**
     * 发送聊天完成请求
     * @param {Object} options - 请求选项
     * @param {string} options.messages - 消息数组
     * @param {string} [options.model] - 模型名称
     * @param {number} [options.temperature] - 温度参数
     * @param {number} [options.maxTokens] - 最大令牌数
     * @param {boolean} [options.stream] - 是否使用流式响应
     * @returns {Promise<Object>} 响应数据
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
     * @param {string} message - 用户消息
     * @param {Object} options - 其他选项
     * @returns {Promise<string>} AI 回复内容
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
     * @param {string} message - 用户消息
     * @param {Function} onChunk - 处理每个数据块的函数
     * @param {Object} options - 其他选项
     * @returns {Promise<void>}
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

    /**
     * 创建对话会话
     * @param {Object} options - 会话选项
     * @returns {ConversationSession} 对话会话对象
     */
    createConversation(options = {}) {
        return new ConversationSession(this, options);
    }
}

/**
 * 对话会话类
 */
class ConversationSession {
    constructor(client, options = {}) {
        this.client = client;
        this.messages = [];
        this.options = options;
    }

    /**
     * 添加用户消息
     * @param {string} content - 消息内容
     */
    addUserMessage(content) {
        this.messages.push({ role: 'user', content });
    }

    /**
     * 添加助手消息
     * @param {string} content - 消息内容
     */
    addAssistantMessage(content) {
        this.messages.push({ role: 'assistant', content });
    }

    /**
     * 添加系统消息
     * @param {string} content - 消息内容
     */
    addSystemMessage(content) {
        this.messages.unshift({ role: 'system', content });
    }

    /**
     * 发送消息并获取回复
     * @param {string} message - 用户消息
     * @param {Object} options - 其他选项
     * @returns {Promise<string>} AI 回复内容
     */
    async sendMessage(message, options = {}) {
        this.addUserMessage(message);
        
        const response = await this.client.chat({
            messages: this.messages,
            ...options
        });

        if (response.choices && response.choices.length > 0) {
            const content = response.choices[0].message.content;
            this.addAssistantMessage(content);
            return content;
        } else {
            throw new Error('响应中没有找到内容');
        }
    }

    /**
     * 流式发送消息
     * @param {string} message - 用户消息
     * @param {Function} onChunk - 处理每个数据块的函数
     * @param {Object} options - 其他选项
     * @returns {Promise<void>}
     */
    async sendMessageStream(message, onChunk, options = {}) {
        this.addUserMessage(message);
        
        const stream = await this.client.chat({
            messages: this.messages,
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
                            this.addAssistantMessage(fullContent);
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

    /**
     * 清空对话历史
     */
    clear() {
        this.messages = [];
    }

    /**
     * 获取对话历史
     * @returns {Array} 消息数组
     */
    getMessages() {
        return [...this.messages];
    }
}

// 导出类
if (typeof module !== 'undefined' && module.exports) {
    // Node.js 环境
    module.exports = { GeminiClient, ConversationSession };
} else if (typeof window !== 'undefined') {
    // 浏览器环境
    window.GeminiClient = GeminiClient;
    window.ConversationSession = ConversationSession;
}