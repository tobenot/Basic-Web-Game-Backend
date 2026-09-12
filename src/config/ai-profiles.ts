export const BEYOND_BOOKS_MODEL = 'deepseek-flash';
export const DEFAULT_BEYOND_BOOKS_APP_ID = 'beyond-books';
export const DEFAULT_BEYOND_BOOKS_BASE_URL = 'https://api.deepseek.com';

export type AiProfile = {
  id: 'legacy' | 'beyond-books';
  appId?: string;
  provider: 'legacy' | 'deepseek';
  gameId?: string;
  defaultModel?: string;
  allowedModels?: readonly string[];
};

export type ProfileProviderConfig = {
  apiKey: string | undefined;
  baseUrl: string;
};

const legacyProfile: AiProfile = {
  id: 'legacy',
  provider: 'legacy',
};

export function getBeyondBooksAppId(): string {
  return process.env.BEYOND_BOOKS_APP_ID?.trim() || DEFAULT_BEYOND_BOOKS_APP_ID;
}

export function getBeyondBooksAllowedModel(): string {
  const configured = process.env.BEYOND_BOOKS_ALLOWED_MODEL?.trim();
  if (configured && configured !== BEYOND_BOOKS_MODEL) {
    console.warn('[ai-profile] Ignoring non-official Beyond-Books model assertion.');
  }
  return BEYOND_BOOKS_MODEL;
}

export function resolveAiProfile(appId?: unknown): AiProfile {
  if (typeof appId === 'string' && appId === getBeyondBooksAppId()) {
    const model = getBeyondBooksAllowedModel();
    return {
      id: 'beyond-books',
      appId: getBeyondBooksAppId(),
      provider: 'deepseek',
      gameId: 'beyond-books',
      defaultModel: model,
      allowedModels: [model],
    };
  }
  return legacyProfile;
}

export function validateModelForProfile(
  profile: AiProfile,
  model: unknown,
): { allowed: boolean } {
  if (!profile.allowedModels) return { allowed: true };
  return {
    allowed: typeof model === 'string' && profile.allowedModels.includes(model),
  };
}

export function getProfileProviderConfig(profile: AiProfile): ProfileProviderConfig | null {
  if (profile.id !== 'beyond-books') return null;
  return {
    apiKey: process.env.BEYOND_BOOKS_DEEPSEEK_API_KEY,
    baseUrl: process.env.BEYOND_BOOKS_DEEPSEEK_BASE_URL || DEFAULT_BEYOND_BOOKS_BASE_URL,
  };
}
