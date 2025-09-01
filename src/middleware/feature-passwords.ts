import { FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import { hasPermission, isFeaturePasswordRequired } from '../config/feature-passwords';

const handleCors = (request: FastifyRequest, reply: FastifyReply) => {
	const origin = request.headers.origin;
	if (origin) {
		reply.header('Access-Control-Allow-Origin', origin);
		reply.header('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
		reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-feature-password');
		reply.header('Access-Control-Max-Age', '86400'); // 24 hours
	}
};

const sendPermissionError = (reply: FastifyReply, isStream: boolean) => {
	const errorPayload = {
		error: {
			message: 'A valid feature password is required for this operation.',
			type: 'permission_error',
			code: 'invalid_feature_password'
		}
	};
	if (isStream) {
		reply.raw.setHeader('Content-Type', 'text/event-stream');
		reply.raw.setHeader('Cache-Control', 'no-cache');
		reply.raw.setHeader('Connection', 'keep-alive');
		reply.raw.write(`data: ${JSON.stringify(errorPayload)}\n\n`);
		reply.raw.write('data: [DONE]\n\n');
		reply.raw.end();
	} else {
		reply.code(403).send(errorPayload);
	}
};

type GetRequiredPermissionFunc = (request: FastifyRequest) => string | null;

/**
 * Creates a Fastify pre-handler to check for a feature password.
 * @param getRequiredPermission A function that determines the required permission from the request.
 * @returns A preHandler hook.
 */
export const featurePasswordAuth = (getRequiredPermission: GetRequiredPermissionFunc): preHandlerHookHandler => {
	return (request, reply, done) => {
		// Handle CORS preflight requests
		handleCors(request, reply);
		if (request.method === 'OPTIONS') {
			return reply.code(204).send();
		}

		if (!isFeaturePasswordRequired) {
			return done();
		}

		const requiredPermission = getRequiredPermission(request);
		if (!requiredPermission) {
			// If no permission is required for this specific request, proceed.
			return done();
		}

		const password = request.headers['x-feature-password'] as string | undefined;

		if (hasPermission(password, requiredPermission)) {
			done();
		} else {
			const body = request.body as { stream?: boolean } | undefined;
			sendPermissionError(reply, body?.stream === true);
			// The reply is sent, so we don't call done() to stop further processing.
		}
	};
};
