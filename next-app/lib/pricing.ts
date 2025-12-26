export type ModelPricing = {
  inputPerMillion: number;
  outputPerMillion: number;
  cachedPerMillion: number;
};

export type PricingMap = Record<string, ModelPricing>;

// Default fallback pricing (extend as needed)
export const DEFAULT_PRICING: PricingMap = {
  "gpt-4.1-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6, cachedPerMillion: 0.075 },
  "gpt-4.1": { inputPerMillion: 5.0, outputPerMillion: 15.0, cachedPerMillion: 2.5 },
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6, cachedPerMillion: 0.075 },
};

export function calcCostUsd(params: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens?: number;
  cachedTokens?: number;
  pricingMap?: PricingMap;
}): number {
  const map = params.pricingMap ?? DEFAULT_PRICING;
  const cfg = map[params.model];
  if (!cfg) return 0;

  const input = (params.inputTokens / 1_000_000) * cfg.inputPerMillion;
  const outputTokens = params.outputTokens + (params.reasoningTokens ?? 0);
  const output = (outputTokens / 1_000_000) * cfg.outputPerMillion;
  const cached = ((params.cachedTokens ?? 0) / 1_000_000) * cfg.cachedPerMillion;

  return Number((input + output + cached).toFixed(6));
}
