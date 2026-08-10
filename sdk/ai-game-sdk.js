/*!
 * AiGameSDK —— 极轻量 AI 游戏前端 SDK（零依赖，纯原生 fetch + SSE）
 *
 * 用法：
 *   const ai = AiGameSDK.init({ gameId: 'wenming', apiBase: 'https://api.example.com' });
 *   await ai.chat([{ role: 'user', content: '你好' }], { onChunk: (c) => ... });
 *
 * 会话：服务端 HttpOnly cookie 自动管理，本 SDK 只保证 credentials:'include'，无状态。
 * Turnstile：配置 turnstileSiteKey 后，首次对话返回 403 turnstile_required 时自动弹验证并重试。
 * 兑换码：ai.redeem(code)。
 *
 * 类型：`import type { ChatCompletionRequest, ChatCompletionChunk } from '@tobenot/basic-web-game-backend-contract'`
 */
(function (global) {
  'use strict';

  const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

  class AiGameSDK {
    /**
     * @param {{gameId:string, apiBase:string, turnstileSiteKey?:string}} options
     */
    constructor(options) {
      this.gameId = options.gameId;
      this.apiBase = (options.apiBase || '').replace(/\/+$/, '');
      this.turnstileSiteKey = options.turnstileSiteKey || null;
    }

    static init(options) {
      return new AiGameSDK(options);
    }

    /**
     * AI 对话。默认流式(SSE)。
     * @param {Array<{role:string,content:string}>} messages
     * @param {{stream?:boolean, onChunk?:Function, signal?:AbortSignal, model?:string, temperature?:number}} [opts]
     * @returns {Promise<object>} 非流式返回完整响应;流式在 [DONE] 后 resolve。
     */
    async chat(messages, opts = {}) {
      const { stream = true, onChunk, signal, model, temperature } = opts;
      const body = { model, messages, stream, game_id: this.gameId };
      if (temperature != null) body.temperature = temperature;

      let attempt = 0;
      while (attempt < 2) {
        attempt++;
        const response = await fetch(`${this.apiBase}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(body),
          signal,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          const code = err.error || err.message;
          if (code === 'turnstile_required' && this.turnstileSiteKey) {
            await this.verifyTurnstile();
            continue; // 验证通过后重试原请求
          }
          const e = new Error(err.message || `AI 请求失败(${response.status})`);
          e.code = code;
          e.degradedMessage = err.degradedMessage; // 额度耗尽/熔断时给玩家的降级文案
          throw e;
        }

        if (!stream) return await response.json();
        return await this._readSSE(response, onChunk);
      }
      throw new Error('人机验证未通过');
    }

    /**
     * 兑换码加量。
     * @param {string} code
     * @returns {Promise<{addedTokens:number, balance:number}>}
     */
    async redeem(code) {
      const data = await this._tRPC('redeem.redeemCode', { code, gameId: this.gameId });
      return data;
    }

    /** 人机验证（一般不需要手动调，chat 遇 403 会自动触发）。 */
    verifyTurnstile() {
      return new Promise((resolve, reject) => {
        this._loadTurnstileScript()
          .then(() => {
            const wrapper = document.createElement('div');
            wrapper.id = 'ai-game-turnstile-' + Date.now();
            document.body.appendChild(wrapper);
            turnstile.render(wrapper.id, {
              sitekey: this.turnstileSiteKey,
              callback: (token) => {
                this._verifyToken(token).then(resolve).catch(reject);
              },
              'error-callback': () => reject(new Error('人机验证失败')),
              'expired-callback': () => reject(new Error('人机验证已过期')),
            });
          })
          .catch(reject);
      });
    }

    async _verifyToken(token) {
      const data = await this._tRPC('turnstile.verifyCode', { token });
      if (!data?.verified) throw new Error('人机验证失败');
      return data;
    }

    async _tRPC(procedure, input) {
      const response = await fetch(`${this.apiBase}/${procedure}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(input),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const shape = body?.error || {};
        const e = new Error(shape.message || `请求失败(${response.status})`);
        e.code = shape.code;
        throw e;
      }
      return body?.result?.data;
    }

    async _readSSE(response, onChunk) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const emit = (line) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) return;
        const data = trimmed.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          if (onChunk) onChunk(JSON.parse(data));
        } catch { /* 忽略不完整行 */ }
      };
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx;
        while ((idx = buffer.indexOf('\n')) >= 0) {
          emit(buffer.slice(0, idx));
          buffer = buffer.slice(idx + 1);
        }
      }
      if (buffer.length > 0) emit(buffer); // 冲刷尾部残留
    }

    _loadTurnstileScript() {
      return new Promise((resolve, reject) => {
        if (typeof turnstile !== 'undefined') return resolve();
        if (!this.turnstileSiteKey) return reject(new Error('未配置 turnstileSiteKey'));
        const existing = document.querySelector(`script[src="${TURNSTILE_SCRIPT}"]`);
        if (existing) {
          existing.addEventListener('load', () => resolve(), { once: true });
          existing.addEventListener('error', () => reject(new Error('Turnstile 脚本加载失败')), { once: true });
          return;
        }
        const script = document.createElement('script');
        script.src = TURNSTILE_SCRIPT;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Turnstile 脚本加载失败'));
        document.head.appendChild(script);
      });
    }
  }

  global.AiGameSDK = AiGameSDK;
  if (typeof module !== 'undefined' && module.exports) module.exports = AiGameSDK;
})(typeof window !== 'undefined' ? window : globalThis);
