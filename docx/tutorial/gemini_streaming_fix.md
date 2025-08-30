
# Gemini 流式响应问题及解决方案

## 1. 问题描述

在使用 Google Gemini 模型进行流式聊天时，后端代理（`llm-proxy.ts`）能够从 Gemini API 接收到完整的响应数据，但前端（或通过 `curl` 直接请求后端）却始终只收到 `data: [DONE]` 消息，而没有任何实际内容。DeepSeek 模型在相同配置下工作正常。

## 2. 问题根源分析

通过详细的日志和 `curl` 调试，我们发现：

1.  **Gemini API 的流式数据格式特点**：Gemini API 返回的流式数据不是传统的 [Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events/Using_server-sent_events) 格式，也不是每行一个完整的 JSON 对象（NDJSON）。它实际上是将一个**完整的 JSON 数组**（以 `[` 开始，以 `]` 结束）拆分成了许多非常小的数据块（chunks）发送过来。这些数据块可能包含 JSON 片段，甚至单个字符（如 `,`）。

2.  **原有增量 JSON 解析器的缺陷**：我们后端 `llm-proxy.ts` 中用于解析 Gemini 流的增量 JSON 解析器，由于其复杂性，未能正确识别并拼装出完整的 JSON 数组。这意味着所有接收到的数据都堆积在内部缓冲区中，直到流结束，解析器也未能成功提取出任何有效的 JSON 对象来转发给前端。

## 3. 解决方案

为了解决 Gemini 流式响应的解析问题，我们采用了“**完整接收，一次解析，批量发送**”的策略，并对 `src/framework/routers/llm-proxy.ts` 进行了以下修改：

1.  **废弃增量解析**：移除了原有的复杂增量 JSON 解析逻辑。
2.  **完整数据拼接**：在接收 Gemini API 响应的 `while` 循环中，不再尝试实时解析，而是将所有接收到的数据块简单地拼接成一个完整的字符串 (`fullJsonString`)。
3.  **最终解析与批量发送**：当 Gemini 的数据流完全结束后，`while` 循环退出。此时，`fullJsonString` 中包含了完整的 JSON 数组。我们使用 `JSON.parse(fullJsonString)` 一次性解析出所有数据，然后遍历得到的 JSON 数组。
4.  **构建并发送 SSE 事件**：对于数组中的每一个 JSON 对象，我们将其转换为标准的 Server-Sent Events (SSE) 格式（`data: <json>\n\n`），并立即通过 `await writeAndDrain(reply, sseData)` 发送给客户端。

### 示例代码（关键部分）

```typescript
// ... existing imports and writeAndDrain function ...

const chatCompletionsHandler = async (request: FastifyRequest, reply: FastifyReply) => {
	// ... existing auth and request body validation ...

	if (isGemini) {
		// ... existing GeminiClient setup and headers ...

		try {
			const upstreamRes = await gemini.fetchChatCompletionStream(body, abortController.signal);
			if (!upstreamRes.ok || !upstreamRes.body) {
				// ... error handling ...
			} else {
				const query = request.query as any;
				const reasoningToContent = query?.reasoning_to_content === '1' || query?.reasoning_to_content === 'true';
				const reader = upstreamRes.body.getReader();
				const decoder = new TextDecoder();
				let messageId = `gen-${Date.now()}`;
				let created = Math.floor(Date.now() / 1000);
				
				let fullJsonString = '';
				while (true) {
					const { value, done } = await reader.read();
					if (done) break;
					if (!value) continue;
					const chunk = decoder.decode(value, { stream: true });
					fullJsonString += chunk;
				}

				try {
					const geminiArray = JSON.parse(fullJsonString);
					for (const geminiData of geminiArray) {
						const candidates = geminiData?.candidates || [];
						let reasoningContent = '';
						
						if (geminiData?.thinking) {
							reasoningContent = geminiData.thinking;
						}
						
						for (const candidate of candidates) {
							let text = '';
							let candidateReasoning = '';

							const parts = candidate?.content?.parts || [];
							for (const part of parts) {
								if (part?.thought) {
									candidateReasoning += part.text || '';
								} else {
									text += part.text || '';
								}
							}
							
							if (reasoningContent && !candidateReasoning) {
								candidateReasoning = reasoningContent;
							}
							
							const chunk = {
								id: messageId,
								object: 'chat.completion.chunk',
								created,
								model: body.model,
								choices: [{
									index: 0,
									delta: reasoningToContent ? 
										{ content: candidateReasoning || text } :
										{
											content: text,
											...(candidateReasoning && { reasoning_content: candidateReasoning })
										},
									finish_reason: candidate?.finishReason ? candidate.finishReason.toLowerCase() : null
								}]
							};
							const sseData = `data: ${JSON.stringify(chunk)}\n\n`;
							await writeAndDrain(reply, sseData);
						}
					}
				} catch (e) {
					console.warn('Failed to parse full Gemini response:', fullJsonString, e);
				}
				reply.raw.write('data: [DONE]\n\n');
			}
			// ... existing error handling and cleanup ...
		}
	}
	// ... rest of chatCompletionsHandler ...
};

// ... llmProxyRoutes ...
```

## 4. 权衡与未来改进

当前的解决方案虽然确保了 Gemini 流式响应的正确传输，但它并非真正的逐字流式体验。所有内容（包括思考过程和最终答案）会在一个短暂停顿后一次性显示给用户。在未来，如果需要实现更精细的逐字流式效果，可能需要：

*   **重新审视 Gemini API 的文档**：确认是否存在更适合实时增量解析的流式输出格式或参数。
*   **优化增量 JSON 解析器**：开发一个更健壮的、能处理分块 JSON 数组的增量解析器，该解析器能够可靠地识别并提取出单个的 JSON 对象。
*   **使用专门的 SSE 库**：如果 Fastify 的原生流处理机制存在限制，可以考虑引入专门的 SSE 库来更精细地控制数据流和背压。
