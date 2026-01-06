"use client";

import type { EffortOrNull, EffortLevel, UsageModelGroupBy, EffortFilterValue } from "@/lib/usage/model-normalize";
import type { UsageByModelRow } from "@/app/api/usage/by-model/types";

export type Metrics = {
  requestCount: number;
  failureCount: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  totalTokens: number;
  costUsd: number;
  inputCostUsd: number | null;
  outputCostUsd: number | null;
  cachedCostUsd: number | null;
  pricingConfigured: boolean;
  pricingConflict: boolean;
  cacheHitRate: number;
};

export type EffortDistribution = Record<EffortLevel | "unspecified", number>; // 0..1 share

export type SourceNode = {
  kind: "source";
  key: string; // "s:<canonical>|e:<effort>|src:<authSource>"
  authSource: string | null;
  metrics: Metrics;
};

export type EffortNode = {
  kind: "effort";
  key: string; // "e:<canonical>|<effort>"
  effort: EffortOrNull;
  label: string; // "high" | "unspecified" (UI 再决定文案)
  metrics: Metrics;
  sources: SourceNode[];
};

export type CanonicalNode = {
  kind: "canonical";
  key: string; // "c:<canonical>"
  modelCanonical: string;
  metrics: Metrics;
  distribution: EffortDistribution; // 用于 spark bar
  efforts: EffortNode[];
};

export type TableViewModel =
  | { groupBy: "canonical"; nodes: CanonicalNode[] }
  | {
      groupBy: "canonical_effort";
      rows: Array<{
        key: string;
        modelCanonical: string;
        effort: EffortOrNull;
        metrics: Metrics;
        sources: SourceNode[];
      }>;
    }
  | {
      groupBy: "raw";
      rows: Array<{
        key: string;
        modelRaw: string;
        modelCanonical: string | null;
        effort: EffortOrNull;
        metrics: Metrics;
        sources: SourceNode[];
      }>;
    };

export type BuildTableModelParams = {
  groupBy: UsageModelGroupBy;
  effortFilter: EffortFilterValue[]; // raw 模式忽略
  data: UsageByModelRow[]; // API leaf rows（通常带 authSource）
};
