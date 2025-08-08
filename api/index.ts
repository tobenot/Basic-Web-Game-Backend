import { buildServer } from '../src/app';
import type { VercelRequest, VercelResponse } from '@vercel/node';

let cached: ReturnType<typeof buildServer> | null = null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (!cached) {
      cached = buildServer();
    }
    const server = await cached;
    await server.ready();

    // Fastify can handle Node's req/res directly via routing
    server.server.emit('request', req, res);
  } catch (err) {
    console.error('Serverless handler error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}