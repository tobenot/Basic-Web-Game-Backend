export type ChatMessage = {
	role: 'system' | 'user' | 'assistant' | 'tool' | 'function';
	content: string;
	name?: string;
	reasoning_content?: string;
};

export type ChatCompletionParams = {
	model: string;
	messages: ChatMessage[];
	stream?: boolean;
	temperature?: number;
	top_p?: number;
	presence_penalty?: number;
	frequency_penalty?: number;
	max_tokens?: number;
	stop?: string | string[];
	response_format?: { type: 'text' | 'json_object' };
	[key: string]: unknown;
};

export type ChatCompletionResponse = {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: Array<{
		index: number;
		message: { role: 'assistant'; content: string; reasoning_content?: string };
		finish_reason: string | null;
	}>;
	usage?: unknown;
};

// 超时:非流式=总时长(对齐平台时长上限),流式=空闲超时(不掐长对话)
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS || 60_000);
const IDLE_TIMEOUT_MS = Number(process.env.LLM_IDLE_TIMEOUT_MS || 60_000);

type LlmProvider = {
	name: string;
	apiKey: string | undefined;
	baseUrl: string;
	headers: Record<string, string | undefined>;
};

// ponytail: 流式空闲超时保护。每收到一个 chunk 重置计时,静默超过 idleMs 则中止上游连接;
// 上游断流/客户端断开时 reader.read() 报错,经 catch 结束流,进程不崩。
function withIdleTimeout(body: ReadableStream<Uint8Array>, abort: AbortController, idleMs: number): ReadableStream<Uint8Array> {
	let timer: NodeJS.Timeout;
	const reset = () => {
		clearTimeout(timer);
		timer = setTimeout(() => abort.abort(), idleMs);
	};
	reset();
	const reader = body.getReader();
	return new ReadableStream<Uint8Array>({
		async pull(controller) {
			try {
				const { done, value } = await reader.read();
				if (done) {
					clearTimeout(timer);
					controller.close();
					return;
				}
				reset();
				controller.enqueue(value);
			} catch (err) {
				clearTimeout(timer);
				controller.error(err);
			}
		},
		cancel() {
			clearTimeout(timer);
			reader.cancel().catch(() => {});
		},
	});
}

export class LlmClient {
	private apiKey: string;
	private baseUrl: string;
	private headers: Record<string, string>;

	constructor(options?: { apiKey?: string; baseUrl?: string }) {
		this.headers = { 'Content-Type': 'application/json' };

		// Priority: Explicit options > Environment Variables
		if (options?.apiKey) {
			this.apiKey = options.apiKey;
			// Default to OpenAI URL if baseUrl is not provided, maintaining compatibility
			this.baseUrl = (options.baseUrl || 'https://api.openai.com').replace(/\/$/, '');
			this.headers['Authorization'] = `Bearer ${this.apiKey}`;
			return;
		}

		// Environment-based provider configuration (Priority: OpenRouter > DeepSeek > OpenAI)
		const providers: LlmProvider[] = [
			{
				name: 'OpenRouter',
				apiKey: process.env.OPENROUTER_API_KEY,
				baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
				headers: {
					'HTTP-Referer': process.env.OPENROUTER_HTTP_REFERER,
					'X-Title': process.env.OPENROUTER_X_TITLE,
				},
			},
			{
				name: 'DeepSeek',
				apiKey: process.env.DEEPSEEK_API_KEY,
				baseUrl: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
				headers: {},
			},
			{
				name: 'OpenAI',
				apiKey: process.env.OPENAI_API_KEY,
				baseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com',
				headers: {},
			},
		];

		const activeProvider = providers.find(p => p.apiKey);

		if (activeProvider) {
			this.apiKey = activeProvider.apiKey!;
			this.baseUrl = activeProvider.baseUrl.replace(/\/$/, '');
			this.headers['Authorization'] = `Bearer ${this.apiKey}`;
			for (const key in activeProvider.headers) {
				const value = activeProvider.headers[key];
				if (value) {
					this.headers[key] = value;
				}
			}
		} else {
			throw new Error('API key not set. Please set OPENROUTER_API_KEY, DEEPSEEK_API_KEY, or OPENAI_API_KEY.');
		}
	}

	private getChatCompletionsUrl() {
		return this.baseUrl.endsWith('/v1') ? `${this.baseUrl}/chat/completions` : `${this.baseUrl}/v1/chat/completions`;
	}

	async createChatCompletion(params: ChatCompletionParams) {
		const url = this.getChatCompletionsUrl();
		const res = await fetch(url, {
			method: 'POST',
			headers: this.headers,
			body: JSON.stringify({ ...params, stream: false }),
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
		if (!res.ok) {
			const text = await res.text();
			throw new Error(`LLM provider error ${res.status}: ${text}`);
		}
		return (await res.json()) as ChatCompletionResponse;
	}

	async fetchChatCompletionStream(params: ChatCompletionParams, abortSignal?: AbortSignal) {
		const url = this.getChatCompletionsUrl();
		// 空闲超时信号 + 调用方(客户端断开)信号,合并成一个 abort 信号
		const idleController = new AbortController();
		const fetchSignal = abortSignal ? AbortSignal.any([abortSignal, idleController.signal]) : idleController.signal;
		const res = await fetch(url, {
			method: 'POST',
			headers: this.headers,
			body: JSON.stringify({ ...params, stream: true }),
			signal: fetchSignal,
		} as RequestInit);
		if (res.ok && res.body) {
			// 包一层空闲超时,拿到上游响应后再决定是否写头,4xx 不会挂起
			return new Response(withIdleTimeout(res.body, idleController, IDLE_TIMEOUT_MS), {
				status: res.status,
				headers: res.headers,
			});
		}
		return res;
	}

	async *streamChatCompletion(params: ChatCompletionParams, abortSignal?: AbortSignal): AsyncGenerator<string, void, unknown> {
		const res = await this.fetchChatCompletionStream(params, abortSignal);
		if (!res.ok || !res.body) {
			const text = await res.text().catch(() => '');
			throw new Error(`LLM provider stream error ${res.status}: ${text}`);
		}
		const decoder = new TextDecoder();
		const reader = (res.body as ReadableStream<Uint8Array>).getReader();
		let buffer = '';
		try {
			while (true) {
				const { value, done } = await reader.read();
				if (done) break;
				if (value) {
					buffer += decoder.decode(value, { stream: true });
					let eolIndex: number;
					while ((eolIndex = buffer.indexOf('\n')) >= 0) {
						const line = buffer.slice(0, eolIndex).trim();
						buffer = buffer.slice(eolIndex + 1);
						if (!line) continue;
						if (line.startsWith('data:')) {
							const data = line.slice('data:'.length).trim();
							if (data === '[DONE]') return;
							try {
								const json = JSON.parse(data);
								const reasoning = json?.choices?.[0]?.delta?.reasoning_content;
								if (typeof reasoning === 'string' && reasoning.length > 0) yield JSON.stringify({ reasoning });
								const content = json?.choices?.[0]?.delta?.content;
								if (typeof content === 'string' && content.length > 0) yield JSON.stringify({ content });
							} catch {}
						}
					}
				}
			}
		} finally {
			reader.releaseLock();
		}
		buffer = buffer.trim();
		if (buffer.startsWith('data:')) {
			const data = buffer.slice('data:'.length).trim();
			if (data !== '[DONE]') {
				try {
					const json = JSON.parse(data);
					const reasoning = json?.choices?.[0]?.delta?.reasoning_content;
					if (typeof reasoning === 'string' && reasoning.length > 0) yield JSON.stringify({ reasoning });
					const content = json?.choices?.[0]?.delta?.content;
					if (typeof content === 'string' && content.length > 0) yield JSON.stringify({ content });
				} catch {}
			}
		}
	}
}


