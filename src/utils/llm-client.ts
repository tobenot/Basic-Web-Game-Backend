export type ChatMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool' | 'function';
  content: string;
  name?: string;
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
  // additional passthrough params
  [key: string]: unknown;
};

export type ChatCompletionResponse = {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: { role: 'assistant'; content: string };
    finish_reason: string | null;
  }>;
  usage?: unknown;
};

export class LlmClient {
  private apiKey: string;
  private baseUrl: string;

  constructor(options?: { apiKey?: string; baseUrl?: string }) {
    this.apiKey = options?.apiKey || process.env.OPENAI_API_KEY || '';
    this.baseUrl = (options?.baseUrl || process.env.OPENAI_BASE_URL || 'https://api.openai.com').replace(/\/$/, '');
    if (!this.apiKey) {
      throw new Error('OPENAI_API_KEY is not set. Provide it via env or constructor.');
    }
  }

  async createChatCompletion(params: ChatCompletionParams): Promise<ChatCompletionResponse> {
    const url = `${this.baseUrl}/v1/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ ...params, stream: false }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`OpenAI error ${res.status}: ${text}`);
    }

    return (await res.json()) as ChatCompletionResponse;
  }

  async fetchChatCompletionStream(params: ChatCompletionParams, abortSignal?: AbortSignal): Promise<Response> {
    const url = `${this.baseUrl}/v1/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ ...params, stream: true }),
      signal: abortSignal,
    } as RequestInit);
    return res;
  }

  async *streamChatCompletion(params: ChatCompletionParams, abortSignal?: AbortSignal): AsyncGenerator<string, void, unknown> {
    const url = `${this.baseUrl}/v1/chat/completions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ ...params, stream: true }),
      signal: abortSignal,
    } as RequestInit);

    if (!res.ok || !res.body) {
      const text = await res.text().catch(() => '');
      throw new Error(`OpenAI stream error ${res.status}: ${text}`);
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
              if (data === '[DONE]') {
                return;
              }
              try {
                const json = JSON.parse(data);
                const content = json?.choices?.[0]?.delta?.content;
                if (typeof content === 'string' && content.length > 0) {
                  yield content;
                }
              } catch {
                // ignore malformed json lines
              }
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
          const content = json?.choices?.[0]?.delta?.content;
          if (typeof content === 'string' && content.length > 0) {
            yield content;
          }
        } catch {
          // ignore
        }
      }
    }
  }
}
