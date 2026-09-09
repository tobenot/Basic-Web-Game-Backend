import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createHttpLogFields, sanitizeHttpPath } from '../dist/http-logging.js';

const appSource = fs.readFileSync(new URL('../src/app.ts', import.meta.url), 'utf8');

test('application hooks never serialize request or response headers', () => {
  assert.doesNotMatch(appSource, /JSON\.stringify\([^\n]*(request|reply)[^\n]*headers/i);
  assert.doesNotMatch(appSource, /console\.log\([^\n]*(请求头|响应头)/);
});

test('sanitizes query strings and control characters before logging a request path', () => {
  assert.equal(
    sanitizeHttpPath('/api/auth/verify?token=governance-sentinel\u000d\u000a'),
    '/api/auth/verify',
  );
});

test('uses the registered route when available and emits only bounded request metadata', () => {
  const fields = createHttpLogFields({
    method: 'POST',
    url: '/api/trpc/auth.verify?token=governance-sentinel',
    route: '/api/trpc/auth.verify',
    statusCode: 204,
    durationMs: 12.3456,
  });

  assert.deepEqual(fields, {
    event: 'http_request',
    method: 'POST',
    route: '/api/trpc/auth.verify',
    statusCode: 204,
    durationMs: 12.35,
  });
  assert.equal('headers' in fields, false);
  assert.equal(JSON.stringify(fields).includes('governance-sentinel'), false);
});

test('does not expose an unmatched request path', () => {
  const fields = createHttpLogFields({
    method: 'GET',
    url: '/not-found?secret=governance-sentinel',
    statusCode: 404,
  });

  assert.equal(fields.route, '<unmatched>');
  assert.equal('durationMs' in fields, false);
});
