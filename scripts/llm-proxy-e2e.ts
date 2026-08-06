// LLM 代理 HTTP 层端到端自检:起真实 Fastify 服务 + 本地假上游,不联网。
// 覆盖清单 #1(流式上游报错不挂起)、#5(非流式总时长超时、流式空闲超时)。
// 运行: npx ts-node scripts/llm-proxy-e2e.ts
process.env.NODE_ENV = 'production';
process.env.LLM_TIMEOUT_MS = '400';
process.env.LLM_IDLE_TIMEOUT_MS = '300';
process.env.OPENAI_API_KEY = 'test-key';
process.env.OPENAI_BASE_URL = 'http://127.0.0.1:18925/v1';
process.env.DATABASE_URL = 'file:./dev.db';
process.env.JWT_SECRET = 'test-secret';
process.env.AI_AUTH_REQUIRED = 'false';
process.env.TRPC_AUTH_REQUIRED = 'false';
process.env.CORS_ENABLED = 'false';
// Prisma 会自动加载 .env,里面设了 FEATURE_PASSWORDS 会把中间件打开。
// 用硬开关显式关掉,否则所有请求都会被 feature-password 中间件拦下,测不到代理。
process.env.FEATURE_PASSWORD_ENABLED = 'false';

const http = require('http');
const { buildServer } = require('../src/app');

const FAKE_PORT = 18925;
const APP_PORT = 18926;
let failures = 0;
function check(name: string, cond: boolean, detail = '') {
	console.log(`${cond ? '✅' : '❌'} ${name}${cond ? '' : ` — ${detail}`}`);
	if (!cond) failures++;
}

const fake = http.createServer((req: any, res: any) => {
	let body = '';
	req.on('data', (c: Buffer) => (body += c));
	req.on('end', () => {
		let model = '';
		try { model = JSON.parse(body).model || ''; } catch {}
		if (model === 'error') {
			res.writeHead(429, { 'Content-Type': 'application/json' });
			res.end(JSON.stringify({ error: { message: 'rate limited' } }));
		} else if (model === 'normal') {
			res.writeHead(200, { 'Content-Type': 'text/event-stream' });
			res.write('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n');
			res.write('data: [DONE]\n\n');
			res.end();
		} else if (model === 'idle') {
			res.writeHead(200, { 'Content-Type': 'text/event-stream' });
			res.write('data: {"choices":[{"delta":{"content":"part"}}]}\n\n');
		} else if (model === 'slow') {
			const t = setTimeout(() => {
				try { res.writeHead(200, { 'Content-Type': 'application/json' }); res.end('{"ok":true}'); } catch {}
			}, 5000);
			res.on('close', () => clearTimeout(t));
		} else {
			res.writeHead(200, { 'Content-Type': 'application/json' });
			res.end('{}');
		}
	});
});

const post = (model: string, stream: boolean) =>
	fetch(`http://127.0.0.1:${APP_PORT}/v1/chat/completions`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ model, messages: [{ role: 'user', content: 'x' }], stream }),
	});

fake.listen(FAKE_PORT, async () => {
	try {
		const app = await buildServer();
		await app.listen({ port: APP_PORT, host: '127.0.0.1' });

		// 1. 非流式上游 4xx -> 代理把上游 429 包成 500(不挂起)
		const t0 = Date.now();
		const r1 = await post('openai/error', false);
		const e1 = await r1.text();
		check('非流式上游4xx应返回代理错误(500+429)', r1.status === 500 && e1.includes('429'), `status=${r1.status}, body=${e1}`);
		check('非流式上游4xx及时返回', Date.now() - t0 < 4000, `${Date.now() - t0}ms`);

		// 2+3. 非流式总时长超时 -> 代理及时返回 500(TimeoutError)
		const t1 = Date.now();
		const r2 = await post('openai/slow', false);
		const e2 = await r2.text();
		check('非流式超时应中止', r2.status === 500 && /aborted/i.test(e2), `status=${r2.status}, body=${e2}`);
		check('非流式超时及时(期望~400ms)', Date.now() - t1 < 4000, `${Date.now() - t1}ms`);

		// 4. 流式正常透传:必须看到上游的真实内容
		const r3 = await post('openai/normal', true);
		const e3 = await r3.text();
		check('流式正常透传', r3.status === 200 && e3.includes('[DONE]') && e3.includes('"content":"hi"'), `status=${r3.status}, body=${e3.slice(0, 80)}`);

		// 5+6. 流式空闲超时 -> 代理中止上游并收尾(不挂起)
		const t2 = Date.now();
		const r4 = await post('openai/idle', true);
		const e4 = await r4.text();
		check('流式空闲超时中止', /aborted/i.test(e4), `body=${e4.slice(0, 80)}`);
		check('流式空闲超时及时(期望~300ms)', Date.now() - t2 < 4000, `${Date.now() - t2}ms`);

		await app.close();
	} catch (err: any) {
		console.error('❌ 端到端测试异常:', err);
		failures++;
	} finally {
		fake.close();
		console.log(failures > 0 ? `\n❌ ${failures} 项失败` : '\n✅ 全部通过');
		process.exit(failures > 0 ? 1 : 0);
	}
});
