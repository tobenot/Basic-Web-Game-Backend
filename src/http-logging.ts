export type HttpLogFields = {
  event: 'http_request';
  method: string;
  route: string;
  statusCode: number;
  durationMs?: number;
};

export type HttpLogInput = {
  method: string;
  url: string;
  route?: string;
  statusCode: number;
  durationMs?: number;
};

const MAX_ROUTE_LENGTH = 256;

/**
 * Return a log-safe path. Query strings and fragments may contain credentials,
 * magic-link tokens, or user data, so they are never included in access logs.
 */
export function sanitizeHttpPath(url: string): string {
  const path = (url || '/').split(/[?#]/, 1)[0] || '/';
  const printable = path.replace(/[\u0000-\u001f\u007f]/g, '?');
  return printable.slice(0, MAX_ROUTE_LENGTH) || '/';
}

/**
 * Build the small, bounded access-log payload used by the Fastify response hook.
 * Deliberately do not accept or copy request/response headers.
 */
export function createHttpLogFields(input: HttpLogInput): HttpLogFields {
  const route = input.route && input.route !== '*'
    ? sanitizeHttpPath(input.route)
    : '<unmatched>';
  const fields: HttpLogFields = {
    event: 'http_request',
    method: input.method,
    route,
    statusCode: input.statusCode,
  };

  if (typeof input.durationMs === 'number' && Number.isFinite(input.durationMs) && input.durationMs >= 0) {
    fields.durationMs = Math.round(input.durationMs * 100) / 100;
  }

  return fields;
}
