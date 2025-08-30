export interface AuthConfig {
	enabled: boolean;
	requireAuthForAI: boolean;
	requireAuthForTRPC: boolean;
	jwtSecret: string;
	tokenExpiry: string;
}

export function getAuthConfig(): AuthConfig {
	return {
		enabled: process.env.AUTH_ENABLED !== 'false',
		requireAuthForAI: process.env.AI_AUTH_REQUIRED === 'true',
		requireAuthForTRPC: process.env.TRPC_AUTH_REQUIRED !== 'false',
		jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
		tokenExpiry: process.env.JWT_EXPIRY || '7d'
	};
}

export function isAuthEnabled(): boolean {
	return getAuthConfig().enabled;
}

export function isAIAuthRequired(): boolean {
	const config = getAuthConfig();
	return config.enabled && config.requireAuthForAI;
}

export function isTRPCAuthRequired(): boolean {
	const config = getAuthConfig();
	return config.enabled && config.requireAuthForTRPC;
}
