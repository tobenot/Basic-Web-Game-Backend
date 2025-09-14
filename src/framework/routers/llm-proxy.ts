import { FastifyInstance, FastifyPluginCallback, FastifyRequest, FastifyReply } from 'fastify';
import { LlmClient, ChatCompletionParams } from '../utils/llm-client';
import { GeminiClient } from '../utils/gemini-client';
import { isAIAuthRequired } from '../../config/auth';
import { createAuthContext } from '../../middleware/auth';
import { featurePasswordAuth } from '../../middleware/feature-passwords';
import { getCorsConfig, isOriginAllowed } from '../../config/cors';
import { TRPCError } from '@trpc/server';
import { Readable } from 'stream';
import { z } from 'zod';
import { router, publicProcedure } from '../../trpc';

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
	
	if (!body || !Array.isArray(body.messages) || !body.model) {
		return reply.code(400).send({ error: 'Invalid request: model and messages are required.' });
	}

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

			try {
				const upstreamRes = await gemini.fetchChatCompletionStream(body, abortController.signal);
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
				reply.raw.end();
			}
			return reply;
		} else {
			try {
				const result = await gemini.createChatCompletion({ ...body, stream: false });
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

		try {
			const upstreamRes = await upstream.fetchChatCompletionStream(body, abortController.signal);
			if (!upstreamRes.ok || !upstreamRes.body) {
				const text = await upstreamRes.text().catch(() => '');
				reply.code(upstreamRes.status);
				reply.raw.write(`: upstream error ${text}\n\n`);
			} else {
				const query = request.query as any;
				const reasoningToContent = query?.reasoning_to_content === '1' || query?.reasoning_to_content === 'true';
				if (!reasoningToContent || provider !== 'deepseek') {
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
								try {
									const json = JSON.parse(data);
									const choice = json?.choices?.[0];
									if (choice?.delta?.reasoning_content && !choice?.delta?.content) {
										choice.delta.content = choice.delta.reasoning_content;
									}
									if (choice?.delta?.reasoning_content) {
										delete choice.delta.reasoning_content;
									}
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
			reply.raw.off('close', onClose);
			reply.raw.end();
		}
		return reply;
	}

	try {
		const result = await upstream.createChatCompletion({ ...body, stream: false });
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

export const llmProxyRouter = router({
	chatCompletions: publicProcedure.input(z.any()).mutation(async ({ input, ctx }: { input: any; ctx: any }) => {
		const { req, res } = ctx;
		const body = input as any;
		const originalModel = body.model;

		const { provider, model } = getProviderAndModel(originalModel);
		body.model = model;

		if (provider === 'gemini') {
			if (body.stream) {
				throw new TRPCError({ code: 'BAD_REQUEST', message: 'Gemini streaming is not supported yet.' });
			}
			const gemini = new GeminiClient();
			const result = await gemini.createChatCompletion(body);
			return result;
		}

		const llmClient = getLlmClient(provider);

		if (!body.stream) {
			try {
				const result = await llmClient.createChatCompletion({ ...body, stream: false });
				return result;
			} catch (error: any) {
				console.error('LLM proxy error:', error);
				throw new TRPCError({
					code: 'INTERNAL_SERVER_ERROR',
					message: error.message,
				});
			}
		} else {
			try {
				const stream = await llmClient.fetchChatCompletionStream(body, req.signal);
				if (!stream.body) {
					throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'No response body from LLM provider.' });
				}
				const readable = Readable.fromWeb(stream.body as any);
				readable.pipe(res);
			} catch (error: any) {
				console.error('LLM stream proxy error:', error);
				if (!res.headersSent) {
					res.status(500).send({ error: error.message });
				}
			}
		}
	}),
});


export const llmProxyRoutes: FastifyPluginCallback = (server: FastifyInstance, _opts, done) => {
	server.post('/v1/chat/completions', { preHandler: [featurePasswordAuth(getLlmPermission)] }, chatCompletionsHandler);
	server.post('/api/v1/chat/completions', { preHandler: [featurePasswordAuth(getLlmPermission)] }, chatCompletionsHandler);
	done();
};


