export interface GameConfig {
	id: string;
	name: string;
	defaultModel?: string;
	dailyFreeTokens: number;
	degradedMessage: string;
}

// ponytail: 多游戏平台化(每游戏 prompt/分档额度/降级差异化)等第二款游戏真出现再扩;
// 现在就是「配置条目 + env 覆盖」。DEFAULT_GAME_ID 指定请求缺省 game_id 时的回退。
const defaultGames: Record<string, GameConfig> = {
	wenming: {
		id: 'wenming',
		name: '文明史诗',
		defaultModel: 'deepseek-chat',
		dailyFreeTokens: 20_000,
		degradedMessage: 'AI 额度已用尽，请明天再来，或输入兑换码加量。',
	},
	'beyond-books': {
		id: 'beyond-books',
		name: 'Beyond-Books',
		defaultModel: 'deepseek-flash',
		dailyFreeTokens: 20_000,
		degradedMessage: 'AI 额度已用尽，请稍后再试。',
	},
};

function loadEnvOverrides(): Record<string, GameConfig> {
	const raw = process.env.GAMES_CONFIG;
	if (!raw) return {};
	try {
		const parsed = JSON.parse(raw) as Record<string, Partial<GameConfig>>;
		const out: Record<string, GameConfig> = {};
		for (const [id, cfg] of Object.entries(parsed)) {
			const base: GameConfig = defaultGames[id] ?? {
				id,
				name: id,
				dailyFreeTokens: 10_000,
				degradedMessage: 'AI 额度已用尽，请明天再来，或输入兑换码加量。',
			};
			out[id] = { ...base, ...cfg, id };
		}
		return out;
	} catch (e) {
		console.warn('[games] GAMES_CONFIG 解析失败,忽略 env 覆盖:', e);
		return {};
	}
}

const games: Record<string, GameConfig> = { ...defaultGames, ...loadEnvOverrides() };

export function getGameConfig(gameId: string): GameConfig | null {
	return games[gameId] ?? null;
}

export function getDefaultGameId(): string {
	return process.env.DEFAULT_GAME_ID || 'wenming';
}
