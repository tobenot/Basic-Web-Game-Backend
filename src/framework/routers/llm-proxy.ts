import { FastifyInstance, FastifyPluginCallback } from 'fastify';
import { LlmClient, ChatCompletionParams } from '../utils/llm-client';
import { GeminiClient } from '../utils/gemini-client';

export const llmProxyRoutes: FastifyPluginCallback = (server: FastifyInstance, _opts, done) => {
	server.post('/v1/chat/completions', async (request, reply) => {
		const body = request.body as ChatCompletionParams | undefined;
		if (!body || !Array.isArray(body.messages) || !body.model) {
			return reply.code(400).send({ error: 'Invalid request: model and messages are required.' });
		}

		const isGemini = /^gemini[-_]/i.test(body.model);
		if (isGemini) {
			if (body.stream) {
				return reply.code(400).send({ error: 'Gemini stream is not supported in this proxy.' });
			}
			try {
				const gemini = new GeminiClient();
				const result = await gemini.createChatCompletion({ ...body, stream: false });
				return reply.code(200).send(result);
			} catch (err: any) {
				const text = typeof err?.message === 'string' ? err.message : 'Upstream error';
				return reply.code(500).send({ error: text });
			}
		}

		const upstream = new LlmClient();

		if (body.stream) {
			reply.raw.setHeader('Content-Type', 'text/event-stream');
			reply.raw.setHeader('Cache-Control', 'no-cache');
			reply.raw.setHeader('Connection', 'keep-alive');

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
					const reader = upstreamRes.body.getReader();
					const decoder = new TextDecoder();
					while (true) {
						const { value, done } = await reader.read();
						if (done) break;
						if (value) reply.raw.write(decoder.decode(value, { stream: true }));
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
	});

	done();
};


