import { LlmClient, ChatCompletionParams } from '../framework/llm/llm-client';
import { AiModelRequestOptions, AiModelRequestOptionsWithSignal, AiServiceResponse, AiStreamingChunk } from './types';
import { AiRequestQueueService } from './AiRequestQueueService';

export class AiService {
	private client: LlmClient;
	private queue: AiRequestQueueService;

	constructor(options?: { apiKey?: string; baseUrl?: string; queue?: { concurrencyLimit?: number; minIntervalMs?: number; peakHoursIntervalMs?: number; offPeakHoursIntervalMs?: number; maxIntervalMs?: number } }) {
		this.client = new LlmClient({ apiKey: options?.apiKey, baseUrl: options?.baseUrl });
		this.queue = new AiRequestQueueService(
			this,
			options?.queue?.concurrencyLimit ?? 1,
			options?.queue?.minIntervalMs ?? 200,
			options?.queue?.peakHoursIntervalMs ?? 2000,
			options?.queue?.offPeakHoursIntervalMs ?? 500,
			options?.queue?.maxIntervalMs ?? 60000
		);
	}

	public async callModel(options: AiModelRequestOptions): Promise<AiServiceResponse> {
		return this.queue.submitRequest('call', options);
	}

	public async streamModel(options: AiModelRequestOptionsWithSignal, onChunk: (chunk: AiStreamingChunk) => void): Promise<AiServiceResponse> {
		return this.queue.submitRequest('stream', options, { onChunk, signal: options.signal });
	}

	public async streamToResponse(res: { setHeader: (n: string, v: string) => void; write: (c: string) => void; end: () => void; writableEnded?: boolean; headersSent?: boolean; on?: (e: string, cb: (...a: any[]) => void) => void; off?: (e: string, cb: (...a: any[]) => void) => void }, options: AiModelRequestOptions): Promise<void> {
		return this.queue.submitRequest('streamToResponse', options, { res });
	}

	public async performDirectCallModel(options: AiModelRequestOptions): Promise<AiServiceResponse> {
		const params: ChatCompletionParams = {
			model: options.model,
			messages: options.messages.map(m => ({ role: m.role as any, content: m.content, name: (m as any).name })),
			stream: false,
			temperature: options.temperature,
			max_tokens: options.maxTokens,
		};
		const data = await this.client.createChatCompletion(params);
		const msg = data.choices?.[0]?.message;
		return { role: 'assistant', content: msg?.content ?? '', reasoning_content: '', timestamp: new Date().toISOString() };
	}

	public async performDirectStreamModel(options: AiModelRequestOptionsWithSignal, onChunk: (chunk: AiStreamingChunk) => void): Promise<AiServiceResponse> {
		const params: ChatCompletionParams = {
			model: options.model,
			messages: options.messages.map(m => ({ role: m.role as any, content: m.content, name: (m as any).name })),
			stream: true,
			temperature: options.temperature,
			max_tokens: options.maxTokens,
		};
		const aggregated: AiServiceResponse = { role: 'assistant', content: '', reasoning_content: '', timestamp: new Date().toISOString() };
		try {
			const stream = this.client.streamChatCompletion(params, options.signal);
			for await (const chunk of stream) {
				aggregated.content += chunk;
				aggregated.timestamp = new Date().toISOString();
				onChunk({ current_message: { ...aggregated }, is_finished: false });
			}
			onChunk({ current_message: { ...aggregated }, is_finished: true });
			return aggregated;
		} catch (e: any) {
			if (e?.name === 'AbortError') {
				onChunk({ current_message: { ...aggregated }, is_finished: true, error: e.message });
			} else {
				onChunk({ current_message: { ...aggregated }, is_finished: true, error: e?.message || 'stream error' });
			}
			throw e;
		}
	}

	public async performDirectStreamToResponse(res: { setHeader: (n: string, v: string) => void; write: (c: string) => void; end: () => void; writableEnded?: boolean; headersSent?: boolean; on?: (e: string, cb: (...a: any[]) => void) => void; off?: (e: string, cb: (...a: any[]) => void) => void }, options: AiModelRequestOptions): Promise<void> {
		const params: ChatCompletionParams = {
			model: options.model,
			messages: options.messages.map(m => ({ role: m.role as any, content: m.content, name: (m as any).name })),
			stream: true,
			temperature: options.temperature,
			max_tokens: options.maxTokens,
		};
		res.setHeader('Content-Type', 'text/event-stream');
		res.setHeader('Cache-Control', 'no-cache');
		res.setHeader('Connection', 'keep-alive');
		try {
			const upstream = await this.client.fetchChatCompletionStream(params);
			if (!upstream.ok || !upstream.body) {
				const text = await upstream.text().catch(() => '');
				if (!(res as any).headersSent) {
					res.write(`: error ${text}\n\n`);
				}
				res.end();
				return;
			}
			const reader = upstream.body.getReader();
			const decoder = new TextDecoder();
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				if (value) res.write(decoder.decode(value, { stream: true }));
			}
			res.end();
		} catch (e: any) {
			try {
				res.write(`: error ${(e?.message as string) || 'stream error'}\n\n`);
			} catch {}
			res.end();
		}
	}

	public getQueueStatus() {
		return this.queue.getQueueStatus();
	}

	public setQueueConcurrency(limit: number) {
		this.queue.setConcurrency(limit);
	}

	public setQueueActivityLevel(isActive: boolean) {
		this.queue.setActivityLevel(isActive);
	}

	public updateQueueIntervalSettings(settings: { minIntervalMs?: number; peakHoursIntervalMs?: number; offPeakHoursIntervalMs?: number; maxIntervalMs?: number }) {
		this.queue.updateIntervalSettings(settings);
	}

	public getAiRequestQueueService() {
		return this.queue;
	}
}


