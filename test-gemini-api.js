#!/usr/bin/env node

/**
 * Gemini API 连接测试脚本
 * 用于测试部署在 tko.tobenot.top 的 Gemini API 是否正常工作
 */

const API_BASE = 'https://tko.tobenot.top';

// 测试函数
async function testHealth() {
    console.log('🏥 测试服务器健康状态...');
    try {
        const response = await fetch(`${API_BASE}/health`);
        if (response.ok) {
            const data = await response.json();
            console.log('✅ 服务器健康状态正常:', data);
            return true;
        } else {
            console.log('❌ 服务器健康检查失败:', response.status);
            return false;
        }
    } catch (error) {
        console.log('❌ 无法连接到服务器:', error.message);
        return false;
    }
}

async function testBasicChat() {
    console.log('\n💬 测试基本聊天功能...');
    try {
        const response = await fetch(`${API_BASE}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gemini-1.5-pro',
                messages: [
                    { role: 'user', content: '你好！请简单回复"测试成功"。' }
                ],
                temperature: 0.7,
                max_tokens: 100,
                stream: false
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ 基本聊天功能正常');
            console.log('AI 回复:', data.choices[0].message.content);
            return true;
        } else {
            const errorText = await response.text();
            console.log('❌ 基本聊天功能失败:', response.status, errorText);
            return false;
        }
    } catch (error) {
        console.log('❌ 基本聊天功能错误:', error.message);
        return false;
    }
}

async function testStreamingChat() {
    console.log('\n🌊 测试流式聊天功能...');
    try {
        const response = await fetch(`${API_BASE}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gemini-1.5-pro',
                messages: [
                    { role: 'user', content: '请说"流式测试成功"' }
                ],
                temperature: 0.7,
                max_tokens: 50,
                stream: true
            })
        });

        if (response.ok && response.body) {
            console.log('✅ 流式聊天功能正常');
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let receivedData = false;

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
                                if (receivedData) {
                                    console.log('✅ 流式数据接收完成');
                                    return true;
                                }
                            } else {
                                try {
                                    const json = JSON.parse(data);
                                    const content = json.choices?.[0]?.delta?.content;
                                    if (content) {
                                        process.stdout.write(content);
                                        receivedData = true;
                                    }
                                } catch (e) {
                                    // 忽略解析错误
                                }
                            }
                        }
                    }
                }
            } finally {
                reader.releaseLock();
            }
            return receivedData;
        } else {
            const errorText = await response.text();
            console.log('❌ 流式聊天功能失败:', response.status, errorText);
            return false;
        }
    } catch (error) {
        console.log('❌ 流式聊天功能错误:', error.message);
        return false;
    }
}

async function testDifferentModels() {
    console.log('\n🤖 测试不同模型...');
    const models = ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.0-pro'];
    const results = {};

    for (const model of models) {
        try {
            console.log(`测试模型: ${model}`);
            const response = await fetch(`${API_BASE}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'user', content: '请回复"OK"' }
                    ],
                    temperature: 0.1,
                    max_tokens: 10,
                    stream: false
                })
            });

            if (response.ok) {
                const data = await response.json();
                results[model] = '✅ 正常';
                console.log(`  ${model}: ✅ 正常`);
            } else {
                results[model] = '❌ 失败';
                console.log(`  ${model}: ❌ 失败`);
            }
        } catch (error) {
            results[model] = '❌ 错误';
            console.log(`  ${model}: ❌ 错误 - ${error.message}`);
        }
    }

    return results;
}

async function testCORS() {
    console.log('\n🌐 测试 CORS 配置...');
    try {
        const response = await fetch(`${API_BASE}/v1/chat/completions`, {
            method: 'OPTIONS',
            headers: {
                'Origin': 'https://example.com',
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type'
            }
        });

        const corsHeaders = {
            'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
            'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
            'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
        };

        console.log('CORS 头信息:', corsHeaders);
        
        if (corsHeaders['Access-Control-Allow-Origin']) {
            console.log('✅ CORS 配置正常');
            return true;
        } else {
            console.log('❌ CORS 配置可能有问题');
            return false;
        }
    } catch (error) {
        console.log('❌ CORS 测试失败:', error.message);
        return false;
    }
}

// 主测试函数
async function runTests() {
    console.log('🚀 开始 Gemini API 连接测试...\n');
    console.log(`目标服务器: ${API_BASE}\n`);

    const results = {
        health: await testHealth(),
        basicChat: await testBasicChat(),
        streamingChat: await testStreamingChat(),
        cors: await testCORS(),
        models: await testDifferentModels()
    };

    // 输出测试结果摘要
    console.log('\n📊 测试结果摘要:');
    console.log('================');
    console.log(`服务器健康状态: ${results.health ? '✅ 正常' : '❌ 失败'}`);
    console.log(`基本聊天功能: ${results.basicChat ? '✅ 正常' : '❌ 失败'}`);
    console.log(`流式聊天功能: ${results.streamingChat ? '✅ 正常' : '❌ 失败'}`);
    console.log(`CORS 配置: ${results.cors ? '✅ 正常' : '❌ 失败'}`);
    console.log('\n模型支持情况:');
    Object.entries(results.models).forEach(([model, status]) => {
        console.log(`  ${model}: ${status}`);
    });

    // 总体评估
    const criticalTests = [results.health, results.basicChat];
    const allCriticalPassed = criticalTests.every(test => test === true);
    
    console.log('\n🎯 总体评估:');
    if (allCriticalPassed) {
        console.log('✅ Gemini API 服务器运行正常，可以正常使用！');
        console.log('\n💡 使用建议:');
        console.log('  - 前端可以直接使用提供的 gemini-client.js 库');
        console.log('  - 支持流式响应和对话会话功能');
        console.log('  - 建议在生产环境中添加适当的错误处理和重试机制');
    } else {
        console.log('❌ 关键功能测试失败，请检查服务器配置');
        console.log('\n🔧 故障排除建议:');
        console.log('  - 检查服务器是否正常运行');
        console.log('  - 确认 GEMINI_API_KEY 环境变量已正确设置');
        console.log('  - 检查网络连接和防火墙设置');
        console.log('  - 查看服务器日志以获取更多错误信息');
    }
}

// 运行测试
if (require.main === module) {
    runTests().catch(error => {
        console.error('❌ 测试过程中发生错误:', error);
        process.exit(1);
    });
}

module.exports = {
    testHealth,
    testBasicChat,
    testStreamingChat,
    testDifferentModels,
    testCORS,
    runTests
};