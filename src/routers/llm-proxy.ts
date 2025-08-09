import { FastifyInstance, FastifyPluginCallback } from 'fastify';
import { LlmClient, ChatCompletionParams } from '../utils/llm-client';

export const llmProxyRoutes: FastifyPluginCallback = (server: FastifyInstance, _opts, done) => {
  server.post('/v1/chat/completions', async (request, reply) => {
    const body = request.body as ChatCompletionParams | undefined;
    if (!body || !Array.isArray(body.messages) || !body.model) {
      return reply.code(400).send({ error: 'Invalid request: model and messages are required.' });
    }

    const upstream = new LlmClient();

    if (body.stream) {
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');

      const abortController = new AbortController();
      const onClose = () => {
        abortController.abort();
      };
      reply.raw.on('close', onClose);

      try {
        const upstreamRes = await upstream.fetchChatCompletionStream(body, abortController.signal);
        if (!upstreamRes.ok || !upstreamRes.body) {
          const text = await upstreamRes.text().catch(() => '');
          // best-effort JSON error since headers already set to SSE
          reply.code(upstreamRes.status);
          reply.raw.write(`: upstream error ${text}\n\n`);
        } else {
          const reader = upstreamRes.body.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) {
              reply.raw.write(decoder.decode(value, { stream: true }));
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

    // Non-streaming path
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