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

      // OpenAI-compatible chunk scaffolding
      const created = Math.floor(Date.now() / 1000);
      const id = `chatcmpl-proxy-${created}-${Math.random().toString(36).slice(2, 8)}`;
      const model = body.model;

      const initial = {
        id,
        object: 'chat.completion.chunk',
        created,
        model,
        choices: [
          { index: 0, delta: { role: 'assistant' }, finish_reason: null },
        ],
      } as const;
      reply.raw.write(`data: ${JSON.stringify(initial)}\n\n`);

      try {
        for await (const token of upstream.streamChatCompletion(body, abortController.signal)) {
          const chunk = {
            id,
            object: 'chat.completion.chunk',
            created,
            model,
            choices: [
              { index: 0, delta: { content: token }, finish_reason: null },
            ],
          };
          reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
        }

        reply.raw.write('data: [DONE]\n\n');
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