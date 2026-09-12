import test from 'node:test';
import assert from 'node:assert/strict';

process.env.BEYOND_BOOKS_APP_ID = 'beyond-books';
process.env.BEYOND_BOOKS_ALLOWED_MODEL = 'deepseek-flash';
process.env.BEYOND_BOOKS_DEEPSEEK_API_KEY = 'bb-test-key';
process.env.BEYOND_BOOKS_DEEPSEEK_BASE_URL = 'https://bb.example.invalid';
process.env.DEEPSEEK_API_KEY = 'legacy-test-key';
process.env.NODE_ENV = 'development';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.AI_AUTH_REQUIRED = 'false';
process.env.FEATURE_PASSWORD_ENABLED = 'false';
process.env.TURNSTILE_ENABLED = 'false';
process.env.RESEND_API_KEY = 'test-resend-key';

const {
  resolveAiProfile,
  validateModelForProfile,
  getProfileProviderConfig,
} = await import('../dist/config/ai-profiles.js');
const { getLlmClient } = await import('../dist/framework/routers/llm-proxy.js');

test('selects the Beyond-Books profile from its stable app id', () => {
  const profile = resolveAiProfile('beyond-books');

  assert.equal(profile.id, 'beyond-books');
  assert.equal(profile.provider, 'deepseek');
  assert.deepEqual(profile.allowedModels, ['deepseek-flash']);
  assert.equal(profile.gameId, 'beyond-books');
});

test('allows only the official Beyond-Books model', () => {
  const profile = resolveAiProfile('beyond-books');

  assert.equal(validateModelForProfile(profile, 'deepseek-flash').allowed, true);
  assert.equal(validateModelForProfile(profile, 'deepseek-chat').allowed, false);
  assert.equal(validateModelForProfile(profile, 'openai/gpt-4o').allowed, false);
});

test('uses the separate Beyond-Books server key and base URL', () => {
  const profile = resolveAiProfile('beyond-books');
  const provider = getProfileProviderConfig(profile);

  assert.equal(provider.apiKey, 'bb-test-key');
  assert.equal(provider.baseUrl, 'https://bb.example.invalid');
  assert.notEqual(provider.apiKey, process.env.DEEPSEEK_API_KEY);
});

test('falls back to the legacy profile when the app id is absent', () => {
  const profile = resolveAiProfile(undefined);

  assert.equal(profile.id, 'legacy');
  assert.equal(profile.provider, 'legacy');
  assert.equal(profile.allowedModels, undefined);
});

test('sends only server-built provider authorization headers upstream', async () => {
  const profile = resolveAiProfile('beyond-books');
  const client = getLlmClient('deepseek', profile);
  const originalFetch = globalThis.fetch;
  let upstreamHeaders;

  globalThis.fetch = async (_url, init) => {
    upstreamHeaders = Object.fromEntries(new Headers(init.headers).entries());
    return new Response(JSON.stringify({
      id: 'test',
      object: 'chat.completion',
      created: 0,
      model: 'deepseek-flash',
      choices: [{
        index: 0,
        message: { role: 'assistant', content: 'ok' },
        finish_reason: 'stop',
      }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  try {
    await client.createChatCompletion({
      model: 'deepseek-flash',
      messages: [{ role: 'user', content: 'hello' }],
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(upstreamHeaders.authorization, 'Bearer bb-test-key');
  assert.equal(upstreamHeaders['x-api-key'], undefined);
  assert.equal(upstreamHeaders['x-feature-password'], undefined);
  assert.equal(upstreamHeaders['x-client-api-key'], undefined);
});

test('rejects a disallowed model before the upstream path', async () => {
  const { buildServer } = await import('../dist/app.js');
  const app = await buildServer();

  try {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/chat/completions',
      headers: { 'x-app-id': 'beyond-books' },
      payload: {
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: 'hello' }],
      },
    });

    assert.equal(response.statusCode, 400);
    assert.deepEqual(response.json(), {
      error: 'model_not_allowed',
      message: 'The requested model is not permitted for this application profile.',
    });
  } finally {
    await app.close();
  }
});
