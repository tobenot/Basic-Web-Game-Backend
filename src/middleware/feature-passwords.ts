import { FastifyRequest, FastifyReply } from 'fastify';
import { isFeaturePasswordRequired, hasPermission } from '../config/feature-passwords';
import { getCorsConfig, isOriginAllowed } from '../config/cors';

type PermissionProvider = (request: FastifyRequest) => string | null;

export function featurePasswordAuth(permissionProvider: PermissionProvider) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip auth for OPTIONS pre-flight requests
    if (request.method === 'OPTIONS') {
      return;
    }

    // If the feature password system is disabled globally, allow the request
    if (!isFeaturePasswordRequired) {
      return;
    }

    const permission = permissionProvider(request);
    // If this specific route doesn't require a permission, allow the request
    if (!permission) {
      return;
    }

    const password = request.headers['x-feature-password'] as string | undefined;

    // Check if the provided password grants the required permission
    if (!hasPermission(password, permission)) {
      const errorPayload = {
        error: {
          message: 'A valid feature password is required for this operation.',
          type: 'permission_error',
          code: 'invalid_feature_password'
        }
      };

      const body = request.body as any;
      if (body?.stream) {
        // We are directly manipulating the stream, so we need to set CORS headers manually for the error response.
        const cors = getCorsConfig();
        const origin = request.headers.origin;
        if (cors.enabled && origin && isOriginAllowed(origin, cors)) {
          reply.raw.setHeader('Access-Control-Allow-Origin', origin);
          reply.raw.setHeader('Access-Control-Allow-Credentials', cors.credentials.toString());
        }
        reply.raw.setHeader('Content-Type', 'text/event-stream');
        reply.raw.setHeader('Cache-Control', 'no-cache');
        reply.raw.setHeader('Connection', 'keep-alive');
        reply.raw.write(`data: ${JSON.stringify(errorPayload)}\n\n`);
        reply.raw.write('data: [DONE]\n\n');
        reply.raw.end();
      } else {
        reply.code(403).send(errorPayload);
      }
      return reply; // Stop further execution
    }

    // Password is valid, continue to the main handler
  };
}
