// LLM 代理自检:本地假上游 + 断言,不联网。
// 覆盖清单 #1(流式上游报错不挂起)、#5(非流式总时长超时、流式空闲超时)。
// 运行: npx ts-node scripts/llm-proxy-selfcheck.ts
process.env.LLM_TIMEOUT_MS = '400';
process.env.LLM_IDLE_TIMEOUT_MS = '300';

const { LlmClient } = require('../src/framework/utils/llm-client');
const http = require('http');

const PORT = 18923;
let failures = 0;
function check(name: string, cond: boolean, detail = '') {
	console.log(`${cond ? '✅' : '❌'} ${name}${cond ? '' : ` — ${detail}`}`);
	if (!cond) failures++;
}

const server = http.createServer((req: any, res: any) => {
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
			// 发一个 chunk 后静默:等客户端侧空闲超时中止
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

server.listen(PORT, async () => {
	const client = new LlmClient({ apiKey: 'test', baseUrl: `http://127.0.0.1:${PORT}/v1` });
	try {
		// 1. 非流式上游 4xx -> 抛错(而非挂起)
		try {
			await client.createChatCompletion({ model: 'error', messages: [{ role: 'user', content: 'x' }] });
			check('非流式上游4xx应抛错', false, '未抛错');
		} catch (e: any) {
			check('非流式上游4xx应抛错', /429|rate limited/.test(e.message), e.message);
		}

		// 2. 非流式总时长超时 -> 及时中止
		const t0 = Date.now();
		try {
			await client.createChatCompletion({ model: 'slow', messages: [{ role: 'user', content: 'x' }] });
			check('非流式超时应中止', false, '未中止');
		} catch (e: any) {
			check('非流式超时应中止', /timeout|abort/i.test(String(e.name)) || /abort/i.test(e.message), `${e.name}: ${e.message}`);
		}
		check('非流式超时及时(期望~400ms)', Date.now() - t0 < 4000, `${Date.now() - t0}ms`);

		// 3. 流式正常透传
		const okRes = await client.fetchChatCompletionStream({ model: 'normal', messages: [{ role: 'user', content: 'x' }] });
		const okText = await okRes.text();
		check('流式正常透传', okRes.ok && okText.includes('[DONE]'), okText);

		// 4. 流式空闲超时 -> 不挂起,及时中止
		const t1 = Date.now();
		const idleRes = await client.fetchChatCompletionStream({ model: 'idle', messages: [{ role: 'user', content: 'x' }] });
		try {
			await idleRes.text();
			check('流式空闲超时中止', false, '未中止');
		} catch (e: any) {
			check('流式空闲超时中止', /abort/i.test(String(e.name)) || /abort/i.test(String(e)), `${e.name}: ${e.message}`);
		}
		check('流式空闲超时及时(期望~300ms)', Date.now() - t1 < 4000, `${Date.now() - t1}ms`);
	} finally {
		server.close();
		console.log(failures > 0 ? `\n❌ ${failures} 项失败` : '\n✅ 全部通过');
		process.exit(failures > 0 ? 1 : 0);
	}
});
