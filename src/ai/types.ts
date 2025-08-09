export type AiModelMessage = {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string;
	name?: string;
};

export type AiModelRequestOptions = {
	model: string;
	messages: AiModelMessage[];
	temperature?: number;
	maxTokens?: number;
	[key: string]: unknown;
};

export type AiModelRequestOptionsWithSignal = AiModelRequestOptions & {
	signal?: AbortSignal;
	cancellationKey?: string;
};

export type AiServiceResponse = {
	role: 'assistant';
	content: string;
	reasoning_content?: string;
	timestamp: string;
};

export type AiStreamingChunk = {
	current_message: AiServiceResponse;
	is_finished: boolean;
	error?: string;
};


