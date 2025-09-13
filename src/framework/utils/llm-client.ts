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

type LlmProvider = {
	name: string;
	apiKey: string | undefined;
	baseUrl: string;
	headers: Record<string, string | undefined>;
};

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
		});
		if (!res.ok) {
			const text = await res.text();
			throw new Error(`LLM provider error ${res.status}: ${text}`);
		}
		return (await res.json()) as ChatCompletionResponse;
	}

	async fetchChatCompletionStream(params: ChatCompletionParams, abortSignal?: AbortSignal) {
		const url = this.getChatCompletionsUrl();
		const res = await fetch(url, {
			method: 'POST',
			headers: this.headers,
			body: JSON.stringify({ ...params, stream: true }),
			signal: abortSignal,
		} as RequestInit);
		return res;
	}

	async *streamChatCompletion(params: ChatCompletionParams, abortSignal?: AbortSignal): AsyncGenerator<string, void, unknown> {
		const url = this.getChatCompletionsUrl();
		const res = await fetch(url, {
			method: 'POST',
			headers: this.headers,
			body: JSON.stringify({ ...params, stream: true }),
			signal: abortSignal,
		} as RequestInit);
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


