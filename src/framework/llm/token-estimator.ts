import { ChatMessage } from './llm-client';

export function estimateTokensByChars(charCount: number): number {
	if (!Number.isFinite(charCount) || charCount <= 0) return 0;
	return Math.ceil(charCount / 3.5);
}

export function estimateMessagesTokens(messages: ChatMessage[]): number {
	let total = 0;
	for (const m of messages) {
		const contentLen = (m.content || '').length;
		total += estimateTokensByChars(contentLen) + 4; // 4 tokens per message overhead
	}
	return total + 2; // 2 tokens for end-of-conversation
}


