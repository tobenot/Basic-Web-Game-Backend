// ponytail: 内存固定窗口限流,单实例(ecosystem instances:1)够用;
// 多实例/Serverless 需换 Redis。窗口内超出 limit 返回 false。
export function createRateLimiter(limit: number, windowMs: number): (key: string) => boolean {
	const hits = new Map<string, number[]>();
	return (key: string): boolean => {
		const now = Date.now();
		// Map 只增不减,攻击者轮换 key(IP)会撑爆内存 -> 超过阈值惰性扫一遍过期 key
		if (hits.size > 10_000) {
			for (const [k, arr] of hits) {
				if (!arr.some((t) => now - t < windowMs)) hits.delete(k);
			}
		}
		const arr = (hits.get(key) || []).filter((t) => now - t < windowMs);
		if (arr.length >= limit) {
			hits.set(key, arr);
			return false;
		}
		arr.push(now);
		hits.set(key, arr);
		return true;
	};
}
