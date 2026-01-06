import type { EffortLevel, EffortOrNull, UsageModelGroupBy } from "@/lib/usage/model-normalize";

export type UsageByModelQuery = {
  from?: string; // ISO date
  to?: string; // ISO date
  groupBy?: UsageModelGroupBy; // default "canonical"
  groupBySource?: boolean;
  efforts?: Array<EffortLevel | "unspecified">; // raw 模式下忽略/不允许
};

export type UsageByModelRow = {
  // “model”作为主显示字段（保持向后兼容）
  // canonical/canonical_effort: model = modelCanonical
  // raw: model = modelRaw(或 UsageDaily.model)
  model: string;

  // 额外字段用于 UI & 过滤映射
  modelCanonical: string | null;
  modelRaw: string | null;
  effort: EffortOrNull;

  // 子维度
  authSource: string | null;

  // 指标
  requestCount: number;
  failureCount: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  totalTokens: number;
  costUsd: number;

  // 展示层定价拆分（不改计费，只是展示）
  inputCostUsd: number | null;
  outputCostUsd: number | null;
  cachedCostUsd: number | null;

  // 定价配置状态（考虑 canonical 聚合时的多 raw 冲突）
  pricingConfigured: boolean;
  pricingConflict: boolean;
  pricingModelIds: string[];
};

export type UsageByModelResponse = {
  data: UsageByModelRow[];
  meta: {
    groupBy: UsageModelGroupBy;
    effortsApplied: Array<EffortLevel | "unspecified">;
    usedDaily: boolean;
    usedEvents: boolean;
  };
};

