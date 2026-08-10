import { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { LlmClient, ChatCompletionParams } from '../utils/llm-client';
import { GeminiClient } from '../utils/gemini-client';
import { isAIAuthRequired } from '../../config/auth';
import { createAuthContext } from '../../middleware/auth';
import { featurePasswordAuth } from '../../middleware/feature-passwords';
import { getCorsConfig, isOriginAllowed } from '../../config/cors';
import { getGameConfig, getDefaultGameId } from '../../config/games';
import { getSessionId } from '../../middleware/anonymous-session';
import { checkQuota, recordUsage, estimateTokensFromMessages } from '../../ai/quota';
import { TRPCError } from '@trpc/server';
import { createRateLimiter } from '../utils/rate-limit';

// ponytail: 单实例内存限流;按 IP 每 1 分钟 20 次,正常 demo 用户够用
const llmIpLimiter = createRateLimiter(20, 60 * 1000);

const llmRateLimit = (request: FastifyRequest, reply: FastifyReply) => {
	if (!llmIpLimiter(request.ip)) {
		return reply.code(429).send({ error: 'Too Many Requests', message: '请求过于频繁，请稍后再试。' });
	}
};

const writeAndDrain = (reply: FastifyReply, data: string): Promise<void> => {
	return new Promise((resolve) => {
		if (!reply.raw.write(data)) {
			reply.raw.once('drain', resolve);
		} else {
			process.nextTick(resolve);
		}
	});
};

const chatCompletionsHandler = async (request: FastifyRequest, reply: FastifyReply) => {
	const body = request.body as ChatCompletionParams | undefined;

	if (isAIAuthRequired()) {
		const authContext = await createAuthContext(request);
		if (!authContext.user) {
			const errorPayload = {
				error: {
					message: '需要登录才能访问AI服务',
					type: 'authentication_error',
					code: 'unauthorized'
				}
			};

			if (body?.stream) {
				reply.raw.setHeader('Content-Type', 'text/event-stream');
				reply.raw.setHeader('Cache-Control', 'no-cache');
				reply.raw.setHeader('Connection', 'keep-alive');
				reply.raw.write(`data: ${JSON.stringify(errorPayload)}\n\n`);
				reply.raw.write('data: [DONE]\n\n');
				reply.raw.end();
				return reply;
			} else {
				return reply.code(401).send(errorPayload);
			}
		}
	}
	
	if (!body || !Array.isArray(body.messages) || body.messages.length === 0) {
		return reply.code(400).send({ error: 'Invalid request: messages are required.' });
	}

	// —— 匿名会话 + 游戏配置 + 额度/预算检查 ——
	const sessionId = getSessionId(request);
	if (!sessionId) {
		return reply.code(401).send({ error: 'missing_session', message: '缺少会话，请刷新页面后重试。' });
	}
	const gameId = (body as any).game_id || (request.query as any)?.game_id || getDefaultGameId();
	const gameConfig = getGameConfig(gameId);
	if (!gameConfig) {
		return reply.code(400).send({ error: 'unknown_game', message: `未知的游戏 ID: ${gameId}` });
	}
	// model 可省略:按游戏配置的默认模型补全
	if (!body.model) {
		if (!gameConfig.defaultModel) {
			return reply.code(400).send({ error: 'Invalid request: model is required.' });
		}
		body.model = gameConfig.defaultModel;
	}
	const quota = await checkQuota(sessionId, gameId, gameConfig);
	if (!quota.allowed) {
		const status = quota.code === 'budget_exhausted' ? 503 : 429;
		return reply.code(status).send({ error: quota.code, message: quota.message, degradedMessage: gameConfig.degradedMessage });
	}

	// 成功路径累计 usage,统一在此记额度;流式拿不到 usage 时用估算兜底
	let capturedTokens = 0;
	let capturedContentChars = 0;
	const recordAfterSuccess = async () => {
		const tokens = capturedTokens || (estimateTokensFromMessages(body.messages) + Math.ceil(capturedContentChars / 4));
		await recordUsage(sessionId, gameId, tokens);
	};

	const { provider, model } = getProviderAndModel(body.model);
	body.model = model;

	const setManualCorsHeaders = () => {
		const corsConfig = getCorsConfig();
		const origin = request.headers.origin;
		if (corsConfig.enabled && origin && isOriginAllowed(origin, corsConfig)) {
			reply.raw.setHeader('Access-Control-Allow-Origin', origin);
			reply.raw.setHeader('Access-Control-Allow-Credentials', corsConfig.credentials.toString());
		}
	};
	if (provider === 'gemini') {
		const gemini = new GeminiClient();
		if (body.stream) {
			reply.raw.setHeader('Content-Type', 'text/event-stream');
			reply.raw.setHeader('Cache-Control', 'no-cache');
			reply.raw.setHeader('Connection', 'keep-alive');
			setManualCorsHeaders();

			const abortController = new AbortController();
			const onClose = () => { abortController.abort(); };
			reply.raw.on('close', onClose);
			let streamOk = false;

			try {
				const upstreamRes = await gemini.fetchChatCompletionStream(body, abortController.signal);
				streamOk = upstreamRes.ok && !!upstreamRes.body;
				if (!upstreamRes.ok || !upstreamRes.body) {
					const text = await upstreamRes.text().catch(() => '');
					reply.code(upstreamRes.status);
					reply.raw.write(`: upstream error ${text}\n\n`);
				} else {
					const query = request.query as any;
					const reasoningToContent = query?.reasoning_to_content === '1' || query?.reasoning_to_content === 'true';
					const reader = upstreamRes.body.getReader();
					const decoder = new TextDecoder();
					let messageId = `gen-${Date.now()}`;
					let created = Math.floor(Date.now() / 1000);

					let buffer = '';
					while (true) {
						const { value, done } = await reader.read();
						if (done) break;
						if (!value) continue;
						const chunk = decoder.decode(value, { stream: true });
						buffer += chunk;
						// Gemini's streaming response is a JSON array that comes in chunks.
						// It's not guaranteed that each chunk is a complete JSON object.
						// It's also not NDJSON. It's a single JSON array.
						// So we cannot simply parse line by line.
						// A simple way to handle this is to find JSON objects using bracket matching.

						// This is a very basic parser. It assumes that the stream is a series of JSON objects.
						// A more robust solution might be needed if the structure is more complex.
						let lastPos = 0;
						for (let i = 0; i < buffer.length; i++) {
							if (buffer[i] === '{') {
								let braceCount = 1;
								for (let j = i + 1; j < buffer.length; j++) {
									if (buffer[j] === '{') {
										braceCount++;
									} else if (buffer[j] === '}') {
										braceCount--;
									}
									if (braceCount === 0) {
										const jsonString = buffer.substring(i, j + 1);
										try {
											const geminiData = JSON.parse(jsonString);
											// 用量:每个分片都可能有 usageMetadata,取最后一个
											if (geminiData?.usageMetadata?.totalTokenCount) {
												capturedTokens = geminiData.usageMetadata.totalTokenCount;
											}
											const candidates = geminiData?.candidates || [];
											for (const candidate of candidates) {
												// Split candidate parts into reasoning vs content
												let text = '';
												let candidateReasoning = '';
												const parts = candidate?.content?.parts || [];
												for (const part of parts) {
													const partText = typeof part?.text === 'string' ? part.text : '';
													const isThought = (part as any)?.thought === true || (part as any)?.inlineThought === true || (part as any)?.role === 'thought';
													if (isThought) {
														candidateReasoning += partText;
													} else {
														text += partText;
													}
												}
												if (text) capturedContentChars += text.length;

												// Also consider top-level thinking or candidate.reasoning_content when present
												let aggregatedReasoning = '' as string;
												if (typeof (geminiData as any)?.thinking === 'string' && (geminiData as any).thinking) {
													aggregatedReasoning = (geminiData as any).thinking as string;
												}
												if (candidateReasoning) {
													aggregatedReasoning = candidateReasoning;
												}
												if (!aggregatedReasoning && typeof candidate?.reasoning_content === 'string' && candidate.reasoning_content) {
													aggregatedReasoning = candidate.reasoning_content as string;
												}

												const delta: { content?: string; reasoning_content?: string } = {};
												if (reasoningToContent) {
													if (aggregatedReasoning) {
														delta.content = aggregatedReasoning;
													} else if (text) {
														delta.content = text;
													}
												} else {
													if (text) {
														delta.content = text;
													}
													if (aggregatedReasoning) {
														delta.reasoning_content = aggregatedReasoning;
													}
												}

												const sseChunk = {
													id: messageId,
													object: 'chat.completion.chunk',
													created,
													model: body.model,
													choices: [{
														index: 0,
														delta: delta,
														finish_reason: candidate?.finishReason ? candidate.finishReason.toLowerCase() : null
													}]
												};
												const sseData = `data: ${JSON.stringify(sseChunk)}\n\n`;
												await writeAndDrain(reply, sseData);
											}
										} catch (e) {
											// Incomplete JSON object, wait for more data
										}
										i = j;
										lastPos = j + 1;
										break;
									}
								}
							}
						}
						if (lastPos > 0) {
							buffer = buffer.slice(lastPos);
						}
					}
					reply.raw.write('data: [DONE]\n\n');
				}
			} catch (err: any) {
				try {
					const message = typeof err?.message === 'string' ? err.message : 'Upstream error';
					reply.raw.write(`: error ${message}\n\n`);
				} catch {}
			} finally {
				reply.raw.off('close', onClose);
				if (streamOk) await recordAfterSuccess();
				reply.raw.end();
			}
			return reply;
		} else {
			try {
				const result = await gemini.createChatCompletion({ ...body, stream: false });
				capturedTokens = (result as any)?.usage?.total_tokens ?? 0;
				await recordAfterSuccess();
				return reply.code(200).send(result);
			} catch (err: any) {
				const text = typeof err?.message === 'string' ? err.message : 'Upstream error';
				return reply.code(500).send({ error: text });
			}
		}
	}

	const upstream = getLlmClient(provider);

	if (body.stream) {
		reply.raw.setHeader('Content-Type', 'text/event-stream');
		reply.raw.setHeader('Cache-Control', 'no-cache');
		reply.raw.setHeader('Connection', 'keep-alive');
		setManualCorsHeaders();

		const abortController = new AbortController();
		const onClose = () => { abortController.abort(); };
		reply.raw.on('close', onClose);

		let streamOk = false;
		try {
			const upstreamRes = await upstream.fetchChatCompletionStream(body, abortController.signal);
			streamOk = upstreamRes.ok && !!upstreamRes.body;
			if (!upstreamRes.ok || !upstreamRes.body) {
				const text = await upstreamRes.text().catch(() => '');
				reply.code(upstreamRes.status);
				reply.raw.write(`: upstream error ${text}\n\n`);
			} else {
				const query = request.query as any;
				const reasoningToContent = query?.reasoning_to_content === '1' || query?.reasoning_to_content === 'true';
				// deepseek(primary 游戏供应商)逐行解析:提取 usage 记额度 + 按需合并推理;
				// 其余供应商原样透传(SSE 已是 OpenAI 格式),usage 拿不到时用估算兜底。
				if (provider !== 'deepseek') {
					const reader = upstreamRes.body.getReader();
					const decoder = new TextDecoder();
					while (true) {
						const { value, done } = await reader.read();
						if (done) break;
						if (value) reply.raw.write(decoder.decode(value, { stream: true }));
					}
				} else {
					const reader = upstreamRes.body.getReader();
					const decoder = new TextDecoder();
					let buffer = '';
					while (true) {
						const { value, done } = await reader.read();
						if (done) break;
						if (!value) continue;
						buffer += decoder.decode(value, { stream: true });
						let eolIndex: number;
						while ((eolIndex = buffer.indexOf('\n')) >= 0) {
							const line = buffer.slice(0, eolIndex).trim();
							buffer = buffer.slice(eolIndex + 1);
							if (!line) {
								reply.raw.write('\n');
								continue;
							}
							if (line.startsWith('data:')) {
								const data = line.slice('data:'.length).trim();
								if (data === '[DONE]') {
									reply.raw.write('data: [DONE]\n\n');
									continue;
								}
								let parsed: any = null;
								try { parsed = JSON.parse(data); } catch { parsed = null; }
								if (parsed) {
									if (parsed.usage?.total_tokens) capturedTokens = parsed.usage.total_tokens;
									const delta = parsed.choices?.[0]?.delta;
									if (typeof delta?.content === 'string') capturedContentChars += delta.content.length;
									if (reasoningToContent && delta?.reasoning_content && !delta?.content) {
										delta.content = delta.reasoning_content;
										delete delta.reasoning_content;
									}
									reply.raw.write(`data: ${JSON.stringify(parsed)}\n\n`);
								} else {
									reply.raw.write(`data: ${data}\n\n`);
								}
							} else {
								reply.raw.write(line + '\n');
							}
						}
					}
					// 冲刷尾部残留(upstream 末行可能不带换行)
					if (buffer.length > 0) reply.raw.write(buffer);
				}
			}
		} catch (err: any) {
			try {
				const message = typeof err?.message === 'string' ? err.message : 'Upstream error';
				reply.raw.write(`: error ${message}\n\n`);
			} catch {}
		} finally {
			reply.raw.off('close', onClose);
			if (streamOk) await recordAfterSuccess();
			reply.raw.end();
		}
		return reply;
	}

	try {
		const result = await upstream.createChatCompletion({ ...body, stream: false });
		capturedTokens = (result as any)?.usage?.total_tokens ?? 0;
		await recordAfterSuccess();
		return reply.code(200).send(result);
	} catch (err: any) {
		const text = typeof err?.message === 'string' ? err.message : 'Upstream error';
		return reply.code(500).send({ error: text });
	}
};

const getLlmPermission = (request: FastifyRequest): string | null => {
	const body = request.body as ChatCompletionParams | undefined;
	if (!body?.model) {
		return 'llm-all'; // Fallback if model is not present
	}
	const { provider } = getProviderAndModel(body.model);
	if (provider === 'gemini') {
		return 'llm-gemini';
	}
	if (provider === 'deepseek') {
		return 'llm-deepseek';
	}
	return 'llm-all'; // Default for other models
};

type Provider = 'openai' | 'deepseek' | 'openrouter' | 'gemini' | 'default';

function getProviderAndModel(originalModel: string): { provider: Provider; model: string } {
	if (originalModel.startsWith('gemini-')) {
		return { provider: 'gemini', model: originalModel };
	}
	if (originalModel.startsWith('deepseek/')) {
		return { provider: 'deepseek', model: originalModel.replace('deepseek/', '') };
	}
	if (originalModel.startsWith('openai/')) {
		return { provider: 'openai', model: originalModel.replace('openai/', '') };
	}
	if (originalModel.startsWith('openrouter/')) {
		return { provider: 'openrouter', model: originalModel.replace('openrouter/', '') };
	}
	if (originalModel.startsWith('deepseek-')) {
		return { provider: 'deepseek', model: originalModel };
	}
	return { provider: 'default', model: originalModel };
}

function getLlmClient(provider: Provider): LlmClient {
	switch (provider) {
		case 'openai':
			if (!process.env.OPENAI_API_KEY) throw new TRPCError({ code: 'BAD_REQUEST', message: 'OPENAI_API_KEY is not set on the server.' });
			return new LlmClient({ apiKey: process.env.OPENAI_API_KEY, baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com' });
		case 'deepseek':
			if (!process.env.DEEPSEEK_API_KEY) throw new TRPCError({ code: 'BAD_REQUEST', message: 'DEEPSEEK_API_KEY is not set on the server.' });
			return new LlmClient({ apiKey: process.env.DEEPSEEK_API_KEY, baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com' });
		case 'openrouter':
			if (!process.env.OPENROUTER_API_KEY) throw new TRPCError({ code: 'BAD_REQUEST', message: 'OPENROUTER_API_KEY is not set on the server.' });
			return new LlmClient({ apiKey: process.env.OPENROUTER_API_KEY, baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1' });
		case 'default':
		default:
			// Let the LlmClient constructor figure out the default provider based on env var priority
			return new LlmClient();
	}
}

export const llmProxyRoutes: FastifyPluginCallback = (server: FastifyInstance, _opts, done) => {
	server.post('/v1/chat/completions', { preHandler: [featurePasswordAuth(getLlmPermission), llmRateLimit] }, chatCompletionsHandler);
	server.post('/api/v1/chat/completions', { preHandler: [featurePasswordAuth(getLlmPermission), llmRateLimit] }, chatCompletionsHandler);
	done();
};


