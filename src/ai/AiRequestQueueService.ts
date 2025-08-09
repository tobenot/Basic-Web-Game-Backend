import { AiService } from './AiService';
import { AiModelRequestOptions, AiModelRequestOptionsWithSignal, AiServiceResponse, AiStreamingChunk } from './types';

type StreamResponse = {
	setHeader: (n: string, v: string) => void;
	write: (c: string) => void;
	end: () => void;
	writableEnded?: boolean;
	headersSent?: boolean;
	on?: (e: string, cb: (...a: any[]) => void) => void;
	off?: (e: string, cb: (...a: any[]) => void) => void;
};

type RequestType = 'call' | 'stream' | 'streamToResponse';

type QueuedAiRequest = {
	id: string;
	options: AiModelRequestOptionsWithSignal;
	type: RequestType;
	streamOptions?: { res?: StreamResponse; onChunk?: (chunk: AiStreamingChunk) => void; signal?: AbortSignal };
	resolve: (value: any) => void;
	reject: (reason?: any) => void;
	queuedAt: Date;
};

export class AiRequestQueueService {
	private queue: QueuedAiRequest[] = [];
	private activeProcessors = 0;
	private concurrencyLimit = 1;
	private currentIntervalMs = 1000;
	private minIntervalMs = 200;
	private peakHoursIntervalMs = 2000;
	private offPeakHoursIntervalMs = 500;
	private maxIntervalMs = 60000;
	private ai: AiService;
	private timeCheckIntervalId?: NodeJS.Timeout;

	constructor(ai: AiService, concurrency = 1, minInterval = 200, peak = 2000, offPeak = 500, max = 60000) {
		this.ai = ai;
		this.concurrencyLimit = Math.max(1, concurrency);
		this.minIntervalMs = minInterval;
		this.peakHoursIntervalMs = peak;
		this.offPeakHoursIntervalMs = offPeak;
		this.maxIntervalMs = max;
		this.adjustIntervalForTimeOfDay();
		this.timeCheckIntervalId = setInterval(() => this.adjustIntervalForTimeOfDay(), 15 * 60 * 1000);
	}

	public submitRequest<T extends AiServiceResponse | void>(type: RequestType, options: AiModelRequestOptions, streamOptions?: { res?: StreamResponse; onChunk?: (chunk: AiStreamingChunk) => void; signal?: AbortSignal }): Promise<T> {
		const cancellationKey = (options as any).cancellationKey as string | undefined;
		if (cancellationKey) {
			const idx = this.queue.findIndex(q => (q.options as any).cancellationKey === cancellationKey);
			if (idx > -1) {
				const [removed] = this.queue.splice(idx, 1);
				removed.reject(new Error(`Request ${removed.id} was cancelled and replaced.`));
			}
		}
		return new Promise<T>((resolve, reject) => {
			const withSignal: AiModelRequestOptionsWithSignal = { ...options, signal: streamOptions?.signal || (options as AiModelRequestOptionsWithSignal).signal };
			const req: QueuedAiRequest = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, options: withSignal, type, streamOptions, resolve, reject, queuedAt: new Date() };
			this.queue.push(req);
			this.processQueue();
		});
	}

	private async processQueue(): Promise<void> {
		while (this.activeProcessors < this.concurrencyLimit && this.queue.length > 0) {
			this.activeProcessors++;
			const task = this.queue.shift()!;
			this.executeSingleRequest(task);
			if (this.activeProcessors < this.concurrencyLimit && this.queue.length > 0) {
				await new Promise(r => setTimeout(r, this.currentIntervalMs));
			}
		}
	}

	private async executeSingleRequest(request: QueuedAiRequest): Promise<void> {
		const start = Date.now();
		try {
			let result: AiServiceResponse | void;
			if (request.options.signal?.aborted) {
				throw Object.assign(new Error('Request aborted before start'), { name: 'AbortError' });
			}
			switch (request.type) {
				case 'call':
					result = await this.ai.performDirectCallModel(request.options);
					break;
				case 'stream':
					if (!request.streamOptions?.onChunk) throw new Error('Missing onChunk');
					result = await this.ai.performDirectStreamModel(request.options, request.streamOptions.onChunk);
					break;
				case 'streamToResponse':
					if (!request.streamOptions?.res) throw new Error('Missing response');
					await this.ai.performDirectStreamToResponse(request.streamOptions.res, request.options);
					result = undefined;
					break;
			}
			request.resolve(result as any);
		} catch (e) {
			request.reject(e);
		} finally {
			this.activeProcessors--;
			void start; // keep for future metrics
			this.processQueue();
		}
	}

	private adjustIntervalForTimeOfDay(): void {
		const now = new Date();
		const hourBj = (now.getUTCHours() + 8) % 24;
		const min = now.getUTCMinutes();
		let target = this.peakHoursIntervalMs;
		const offPeak = (hourBj === 0 && min >= 30) || (hourBj >= 1 && hourBj <= 7) || (hourBj === 8 && min <= 30);
		if (offPeak) target = this.offPeakHoursIntervalMs;
		this.currentIntervalMs = Math.max(this.minIntervalMs, Math.min(this.maxIntervalMs, target));
	}

	public setActivityLevel(isActive: boolean): void {
		const base = isActive ? this.currentIntervalMs * 0.66 : this.currentIntervalMs * 1.5;
		this.currentIntervalMs = Math.max(this.minIntervalMs, Math.min(this.maxIntervalMs, base));
	}

	public setConcurrency(limit: number): void {
		const v = Math.max(1, limit);
		if (this.concurrencyLimit !== v) {
			this.concurrencyLimit = v;
			if (v > this.activeProcessors && this.queue.length > 0) this.processQueue();
		}
	}

	public updateIntervalSettings(settings: { minIntervalMs?: number; peakHoursIntervalMs?: number; offPeakHoursIntervalMs?: number; maxIntervalMs?: number }): void {
		if (settings.minIntervalMs !== undefined) this.minIntervalMs = Math.max(10, settings.minIntervalMs);
		if (settings.peakHoursIntervalMs !== undefined) this.peakHoursIntervalMs = settings.peakHoursIntervalMs;
		if (settings.offPeakHoursIntervalMs !== undefined) this.offPeakHoursIntervalMs = settings.offPeakHoursIntervalMs;
		if (settings.maxIntervalMs !== undefined) this.maxIntervalMs = settings.maxIntervalMs;
		this.adjustIntervalForTimeOfDay();
	}

	public getQueueStatus() {
		return {
			queueSize: this.queue.length,
			activeProcessors: this.activeProcessors,
			concurrencyLimit: this.concurrencyLimit,
			currentIntervalMs: this.currentIntervalMs,
			intervalSettings: { min: this.minIntervalMs, peak: this.peakHoursIntervalMs, offPeak: this.offPeakHoursIntervalMs, max: this.maxIntervalMs },
			queuedRequestsSummary: this.queue.slice(0, 20).map(r => ({ id: r.id, type: r.type, queuedAt: r.queuedAt.toISOString(), model: r.options.model || 'default', userMessageSnippet: r.options.messages.find((msg: any) => msg.role === 'user')?.content?.slice(0, 50) ?? 'N/A' })),
		};
	}

	public destroy(): void {
		if (this.timeCheckIntervalId) clearInterval(this.timeCheckIntervalId);
		if (this.queue.length > 0) {
			this.queue.forEach(q => q.reject(new Error('AiRequestQueueService destroyed')));
			this.queue = [];
		}
	}
}


