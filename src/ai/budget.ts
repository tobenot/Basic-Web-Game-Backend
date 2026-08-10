// 全局每日预算硬顶。单实例内存计数(ecosystem instances:1)够用;
// ponytail: 多实例/Serverless 需把计数移到 Redis,接口保持不变即可。
export class DailyTokenBudget {
	private dateKey: string;
	private usedTokens = 0;
	private readonly limitTokens: number;

	constructor(limitTokens?: number) {
		this.limitTokens = limitTokens ?? (Number(process.env.AI_DAILY_BUDGET_TOKENS) || 500_000);
		this.dateKey = todayKey();
	}

	record(tokens: number): void {
		this.ensureToday();
		this.usedTokens += Math.max(0, Math.floor(tokens));
	}

	isExhausted(): boolean {
		this.ensureToday();
		return this.usedTokens >= this.limitTokens;
	}

	getStatus() {
		this.ensureToday();
		return {
			date: this.dateKey,
			limitTokens: this.limitTokens,
			usedTokens: this.usedTokens,
			remainingTokens: Math.max(0, this.limitTokens - this.usedTokens),
			exhausted: this.usedTokens >= this.limitTokens,
		};
	}

	private ensureToday(): void {
		const key = todayKey();
		if (key !== this.dateKey) {
			this.dateKey = key;
			this.usedTokens = 0;
		}
	}
}

export function todayKey(): string {
	const d = new Date();
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, '0');
	const day = String(d.getDate()).padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export const aiBudget = new DailyTokenBudget();
