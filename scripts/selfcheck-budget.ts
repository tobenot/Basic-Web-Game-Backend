// 预算熔断自检(纯内存,无 DB)。运行: npm run selfcheck:budget
import { DailyTokenBudget } from '../src/ai/budget';
import assert from 'assert';

const budget = new DailyTokenBudget(100);
assert.strictEqual(budget.isExhausted(), false, '初始未耗尽');
budget.record(60);
assert.strictEqual(budget.isExhausted(), false, '60 < 100 未耗尽');
budget.record(60);
assert.strictEqual(budget.isExhausted(), true, '120 >= 100 应熔断');
assert.strictEqual(budget.getStatus().usedTokens, 120, '用量累计正确');
budget.record(-50);
assert.strictEqual(budget.getStatus().usedTokens, 120, '负数用量应忽略');

// 跨日重置:构造一个昨日 key 直接改内部状态验证(不依赖真实时钟)
(budget as any).dateKey = '2000-01-01';
assert.strictEqual(budget.isExhausted(), false, '新的一天自动重置');

console.log('✅ selfcheck-budget 通过');
