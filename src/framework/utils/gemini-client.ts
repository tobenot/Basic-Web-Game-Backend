import { ChatCompletionParams, ChatCompletionResponse } from './llm-client';

type GeminiPart = { text: string };
type GeminiContent = { role: 'user' | 'model'; parts: GeminiPart[] };

export class GeminiClient {
	private apiKey: string;
	private baseUrl: string;

	constructor(options?: { apiKey?: string; baseUrl?: string }) {
		this.apiKey = options?.apiKey || process.env.GEMINI_API_KEY || '';
		this.baseUrl = (options?.baseUrl || process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '');
		if (!this.apiKey) {
			throw new Error('GEMINI_API_KEY is not set. Provide it via env or constructor.');
		}
	}

	private toGeminiContents(messages: ChatCompletionParams['messages']): GeminiContent[] {
		const contents: GeminiContent[] = [];
		for (const m of messages) {
			let role: 'user' | 'model' = 'user';
			if (m.role === 'assistant') role = 'model';
			const text = m.content || '';
			contents.push({ role, parts: [{ text }] });
		}
		return contents;
	}

	async createChatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResponse> {
		const url = `${this.baseUrl}/models/${encodeURIComponent(params.model)}:generateContent`;
		const generationConfig: Record<string, unknown> = {};
		if (typeof params.temperature === 'number') generationConfig.temperature = params.temperature;
		if (typeof params.top_p === 'number') generationConfig.topP = params.top_p;
		if (typeof params.max_tokens === 'number') generationConfig.maxOutputTokens = params.max_tokens;
		if (typeof params.stop === 'string') generationConfig.stopSequences = [params.stop];
		if (Array.isArray(params.stop)) generationConfig.stopSequences = params.stop;

		const payload: Record<string, unknown> = {
			contents: this.toGeminiContents(params.messages),
		};
		if (Object.keys(generationConfig).length > 0) {
			(payload as any).generationConfig = generationConfig;
		}

		const res = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'x-goog-api-key': this.apiKey,
			},
			body: JSON.stringify(payload),
		});
		if (!res.ok) {
			const text = await res.text();
			throw new Error(`Gemini error ${res.status}: ${text}`);
		}
		const data = await res.json() as any;
		const candidates: any[] = Array.isArray(data?.candidates) ? data.candidates : [];
		const created = Math.floor(Date.now() / 1000);
		const choices: ChatCompletionResponse['choices'] = candidates.map((c, idx) => {
			const parts: any[] = c?.content?.parts || [];
			const text = parts.map(p => typeof p?.text === 'string' ? p.text : '').join('');
			let finish: string | null = null;
			const fr = c?.finishReason;
			if (typeof fr === 'string') finish = fr.toLowerCase();
			return { index: idx, message: { role: 'assistant' as const, content: text }, finish_reason: finish };
		});
		return {
			id: `gen-${Date.now()}`,
			object: 'chat.completion',
			created,
			model: params.model,
			choices,
		};
	}
}

export default GeminiClient;


