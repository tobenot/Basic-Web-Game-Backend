// ponytail: 内存固定窗口限流,单实例(ecosystem instances:1)够用;
// 多实例/Serverless 需换 Redis。窗口内超出 limit 返回 false。
export function createRateLimiter(limit: number, windowMs: number): (key: string) => boolean {
	const hits = new Map<string, number[]>();
	return (key: string): boolean => {
		const now = Date.now();
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
