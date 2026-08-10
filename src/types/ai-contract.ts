// AI 代理接口的类型契约 —— 随 @tobenot/basic-web-game-backend-contract 发布,供前端 SDK 复用。
// 请求/响应形状以 src/framework/routers/llm-proxy.ts 与 src/framework/utils/llm-client.ts 的实际实现为准。

/** POST /v1/chat/completions 请求体。game_id 为套件专属字段,前端 SDK 会附带。 */
export interface ChatCompletionRequest {
	model?: string;
	messages: Array<{ role: string; content: string; name?: string; reasoning_content?: string }>;
	stream?: boolean;
	temperature?: number;
	max_tokens?: number;
	top_p?: number;
	stop?: string | string[];
	game_id?: string;
}

export interface ChatCompletionUsage {
	prompt_tokens: number;
	completion_tokens: number;
	total_tokens: number;
}

/** 流式输出:每条 `data:` 行都是一个 chunk(OpenAI chat.completion.chunk 格式)。 */
export interface ChatCompletionChunk {
	id: string;
	object: 'chat.completion.chunk';
	created: number;
	model: string;
	choices: Array<{
		index: number;
		// 推理模型把思考过程放在 reasoning_content,正文在 content,前端可分开渲染
		delta: { content?: string; reasoning_content?: string };
		finish_reason: string | null;
	}>;
	usage?: ChatCompletionUsage;
}

export interface ChatCompletionResponse {
	id: string;
	object: 'chat.completion';
	created: number;
	model: string;
	choices: Array<{
		index: number;
		message: { role: string; content: string; reasoning_content?: string };
		finish_reason: string | null;
	}>;
	usage?: ChatCompletionUsage;
}

/** 套件层错误(额度/预算/会话/游戏/人机验证)。SDK 据此给玩家展示降级文案或触发验证。 */
export type AiApiError =
	| { error: 'missing_session'; message: string }
	| { error: 'unknown_game'; message: string }
	| { error: 'turnstile_required'; message: string }
	| { error: 'quota_exceeded'; message: string; degradedMessage: string }
	| { error: 'budget_exhausted'; message: string; degradedMessage: string };
