import { FastifyInstance, FastifyPluginCallback } from 'fastify';
import { LlmClient, ChatCompletionParams, ChatCompletionResponse } from '../llm/llm-client';
import { GeminiClient } from '../llm/gemini-client';
import * as jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import { estimateMessagesTokens, estimateTokensByChars } from '../llm/token-estimator';
import { getPricing, getProviderByModel, calcCostCents } from '../llm/ai-pricing';
import { reserveOrCheck, billAndRecord } from '../llm/ai-audit';

export const llmProxyRoutes: FastifyPluginCallback = (server: FastifyInstance, _opts, done) => {
	server.post('/v1/chat/completions', async (request, reply) => {
		let platformUserId: string | undefined;
		let upstreamApiKey: string | undefined;

		const authHeader = request.headers.authorization;
		if (authHeader?.startsWith('Bearer ')) {
			const token = authHeader.split(' ')[1];
			try {
				const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
				if (decoded.userId) platformUserId = decoded.userId;
				else upstreamApiKey = token;
			} catch (e) {
				upstreamApiKey = token;
			}
		}

		const body = request.body as ChatCompletionParams | undefined;
		if (!body || !Array.isArray(body.messages) || !body.model) {
			return reply.code(400).send({ error: 'Invalid request: model and messages are required.' });
		}
		
		if (!platformUserId && !upstreamApiKey) {
			return reply.code(401).send({ error: 'An API key is required. Please provide a valid JWT for platform access or your own upstream API key.' });
		}

		const provider = getProviderByModel(body.model);
		const isGemini = provider === 'gemini';
		const isDeepseek = provider === 'deepseek';
		const requestId = randomUUID();
		
		if (platformUserId) {
			try {
				const promptTokens = estimateMessagesTokens(body.messages);
				const estimatedCompletionTokens = body.max_tokens || 1024;
				const pricing = getPricing(provider, body.model);
				const estimatedCost = calcCostCents(promptTokens, estimatedCompletionTokens, pricing);
				await reserveOrCheck(platformUserId, Math.max(1, estimatedCost));
			} catch (err: any) {
				return reply.code(402).send({ error: `Payment required: ${err.message}` });
			}
		}

		if (body.stream) {
			if (isGemini) return reply.code(400).send({ error: 'Gemini stream is not supported in this proxy.' });
			
			reply.raw.setHeader('Content-Type', 'text-event-stream');
			reply.raw.setHeader('Cache-Control', 'no-cache');
			reply.raw.setHeader('Connection', 'keep-alive');

			const abortController = new AbortController();
			const onClose = () => { abortController.abort(); };
			reply.raw.on('close', onClose);

			let upstream: LlmClient;
			if (isDeepseek) {
				const apiKey = upstreamApiKey || process.env.DEEPSEEK_API_KEY || '';
				const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
				upstream = new LlmClient({ apiKey, baseUrl });
			} else {
				upstream = new LlmClient({ apiKey: upstreamApiKey });
			}

			let completionContent = '';
			let finalUsage: { prompt_tokens: number; completion_tokens: number; total_tokens: number } | undefined;
			try {
				const upstreamRes = await upstream.fetchChatCompletionStream(body, abortController.signal);
				if (!upstreamRes.ok || !upstreamRes.body) {
					const text = await upstreamRes.text().catch(() => '');
					reply.code(upstreamRes.status);
					reply.raw.write(`: upstream error ${text}\n\n`);
				} else {
					const query = request.query as any;
					const reasoningToContent = query?.reasoning_to_content === '1' || query?.reasoning_to_content === 'true';
					if (!reasoningToContent || !isDeepseek) {
						const reader = upstreamRes.body.getReader();
						const decoder = new TextDecoder();
						while (true) {
							const { value, done } = await reader.read();
							if (done) break;
							if (value) {
								const decodedChunk = decoder.decode(value, { stream: true });
								if (platformUserId) {
									const lines = decodedChunk.split('\n');
									for (const line of lines) {
										if (line.startsWith('data:')) {
											const data = line.slice('data:'.length).trim();
											if (data !== '[DONE]') {
												try {
													const json = JSON.parse(data);
													const content = json?.choices?.[0]?.delta?.content;
													if (content) completionContent += content;
													if (json.usage) finalUsage = json.usage;
												} catch {}
											}
										}
									}
								}
								reply.raw.write(decodedChunk);
							}
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
									try {
										const json = JSON.parse(data);
										const choice = json?.choices?.[0];
										if (choice?.delta?.reasoning_content && !choice?.delta?.content) {
											choice.delta.content = choice.delta.reasoning_content;
										}
										if (choice?.delta?.reasoning_content) {
											delete choice.delta.reasoning_content;
										}
										if (platformUserId && choice?.delta?.content) {
											completionContent += choice.delta.content;
										}
										if (json.usage) finalUsage = json.usage;
										reply.raw.write(`data: ${JSON.stringify(json)}\n\n`);
									} catch {
										reply.raw.write(`data: ${data}\n\n`);
									}
								} else {
									reply.raw.write(line + '\n');
								}
							}
						}
					}
				}
			} catch (err: any) {
				try {
					const message = typeof err?.message === 'string' ? err.message : 'Upstream error';
					reply.raw.write(`: error ${message}\n\n`);
				} catch {}
			} finally {
				if (platformUserId) {
					try {
						let promptTokens: number;
						let completionTokens: number;
						let estimated = true;
						if (finalUsage) {
							promptTokens = finalUsage.prompt_tokens;
							completionTokens = finalUsage.completion_tokens;
							estimated = false;
						} else {
							promptTokens = estimateMessagesTokens(body.messages);
							completionTokens = estimateTokensByChars(completionContent);
						}
						await billAndRecord({ userId: platformUserId, requestId, provider, model: body.model, isStream: true, promptTokens, completionTokens, estimated });
					} catch (billingError: any) {
						console.error(`Billing failed for streamed request ${requestId}:`, billingError);
					}
				}
				reply.raw.off('close', onClose);
				reply.raw.end();
			}
			return reply;
		}

		// Non-streaming
		try {
			let result: ChatCompletionResponse;
			if (isGemini) {
				const gemini = new GeminiClient({ apiKey: upstreamApiKey });
				result = await gemini.createChatCompletion({ ...body, stream: false });
			} else {
				let upstream: LlmClient;
				if (isDeepseek) {
					const apiKey = upstreamApiKey || process.env.DEEPSEEK_API_KEY || '';
					const baseUrl = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '');
					upstream = new LlmClient({ apiKey, baseUrl });
				} else {
					upstream = new LlmClient({ apiKey: upstreamApiKey });
				}
				result = await upstream.createChatCompletion({ ...body, stream: false });
			}

			if (platformUserId) {
				const promptTokens = result.usage?.prompt_tokens ?? estimateMessagesTokens(body.messages);
				const completionTokens = result.usage?.completion_tokens ?? estimateTokensByChars(result.choices[0]?.message?.content || '');
				await billAndRecord({ userId: platformUserId, requestId, provider, model: body.model, isStream: false, promptTokens, completionTokens });
			}

			return reply.code(200).send(result);
		} catch (err: any) {
			const text = typeof err?.message === 'string' ? err.message : 'Upstream error';
			return reply.code(500).send({ error: text });
		}
	});

	done();
};


