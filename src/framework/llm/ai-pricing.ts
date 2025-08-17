export type Pricing = {
	inputPer1k: number;
	outputPer1k: number;
};

type PricingRule = {
	provider: 'openai' | 'deepseek' | 'gemini' | 'other';
	modelPattern: RegExp;
	pricing: Pricing;
};

const builtinRules: PricingRule[] = [
	{ provider: 'openai', modelPattern: /^gpt-4/i, pricing: { inputPer1k: 0.03, outputPer1k: 0.06 } },
	{ provider: 'openai', modelPattern: /^gpt-3.5/i, pricing: { inputPer1k: 0.0015, outputPer1k: 0.002 } },
	{ provider: 'deepseek', modelPattern: /^deepseek-chat/i, pricing: { inputPer1k: 0.001, outputPer1k: 0.002 } },
	{ provider: 'deepseek', modelPattern: /^deepseek-coder/i, pricing: { inputPer1k: 0.001, outputPer1k: 0.002 } },
	{ provider: 'gemini', modelPattern: /^gemini-pro/i, pricing: { inputPer1k: 0.001, outputPer1k: 0.002 } },
	{ provider: 'other', modelPattern: /.*/i, pricing: { inputPer1k: 0.002, outputPer1k: 0.004 } },
];

export function getProviderByModel(model: string): 'openai' | 'deepseek' | 'gemini' | 'other' {
	if (/^deepseek(?:-|$)/i.test(model)) return 'deepseek';
	if (/^gemini-/i.test(model)) return 'gemini';
	if (/^gpt-/i.test(model)) return 'openai';
	return 'other';
}

export function getPricing(provider: string, model: string): Pricing {
	const override = process.env.AI_PRICING_JSON;
	if (override) {
		try {
			const parsed = JSON.parse(override) as Array<{ provider?: string; model?: string; modelPattern?: string; inputPer1k: number; outputPer1k: number }>;
			for (const r of parsed) {
				const p = (r.provider || '').toLowerCase();
				if (p && p !== provider.toLowerCase()) continue;
				const re = r.modelPattern ? new RegExp(r.modelPattern, 'i') : r.model ? new RegExp('^' + r.model.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') : /.*/i;
				if (re.test(model)) return { inputPer1k: r.inputPer1k, outputPer1k: r.outputPer1k };
			}
		} catch (e) {
			console.error("Failed to parse AI_PRICING_JSON", e);
		}
	}
	for (const rule of builtinRules) {
		if ((rule.provider === provider || rule.provider === 'other') && rule.modelPattern.test(model)) return rule.pricing;
	}
	return builtinRules[builtinRules.length - 1].pricing;
}

export function calcCostCents(promptTokens: number, completionTokens: number, pricing: Pricing): number {
	const promptCost = (promptTokens / 1000) * pricing.inputPer1k;
	const completionCost = (completionTokens / 1000) * pricing.outputPer1k;
	return Math.max(0, Math.round((promptCost + completionCost) * 100));
}


