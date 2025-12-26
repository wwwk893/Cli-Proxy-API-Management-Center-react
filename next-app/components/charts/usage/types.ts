export type UsagePoint = {
  bucket: string;
  date?: string;
  totalTokens: number;
  cachedTokens: number;
  costUsd: number;
  requestCount?: number;
  successCount?: number;
  failureCount?: number;
  authSource?: string | null;
};

export type PerModelUsagePoint = UsagePoint & {
  model: string;
  authSource?: string | null;
  requestCount?: number;
  successCount?: number;
  failureCount?: number;
};

export type PerSourceUsagePoint = UsagePoint & {
  authSource: string | null;
};

export type PerChannelUsagePoint = UsagePoint & {
  channel: string;
};

export type PerChannelModelUsagePoint = UsagePoint & {
  model: string;
  channel: string;
};

export type ModelSeriesPoint = {
  bucket: string;
  totalTokens: number;
  cachedTokens: number;
  computedTokens: number;
  chartCachedTokens: number;
  chartComputedTokens: number;
  costUsd: number;
};

export type ModelSeries = {
  model: string; // key (model id, source id, or composite key)
  points: ModelSeriesPoint[];
  totals: {
    totalTokens: number;
    cachedTokens: number;
    costUsd: number;
  };
  modelLabel?: string;
  sourceId?: string | null;
  sourceLabel?: string | null;
};

export type ViewMode = "aggregate" | "per-model" | "source" | "source-model" | "channel" | "channel-model";
export type Dimension = "model" | "source" | "overall" | "model+source" | "channel" | "model+channel";

export type UsageChartMetrics = {
  computedTokens: boolean;
  cachedTokens: boolean;
  costUsd: boolean;
};

export type UsageChartMetricKey = keyof UsageChartMetrics;

export type Granularity = "day" | "hour" | "minute" | "second";

export type UsageQueryParams = {
  filterModels?: string[];
  viewMode: ViewMode;
  granularity: Granularity;
  from?: string | null;
  to?: string | null;
  refreshKey?: string | null;
  sources?: string[];
  channels?: string[];
  dimension?: Dimension;
};
