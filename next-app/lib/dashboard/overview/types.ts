export type DashboardTimeWindow = "utc-today" | "last-24h" | "last-7d" | "last-30d";
export type DashboardChannel = "all" | "cliproxy" | "codex";

export type DashboardOverviewRequest = {
  timeWindow: DashboardTimeWindow;
  channel: DashboardChannel;
};

export type DashboardKpis = {
  costUsd: number; // 估算成本（USD）
  totalTokens: number;
  cachedTokens: number;
  requestCount: number; // v1 口径：UsageEvent 条数 + UsageDaily.totalRequests（见 Q1 处理）
  latestEventTime: string | null; // ISO
};

export type DashboardTrendMetric = "costUsd" | "totalTokens" | "requestCount";
export type DashboardTrendBucket = {
  ts: string; // bucket 起始 ISO（UTC）
  costUsd?: number;
  totalTokens?: number;
  requestCount?: number;
};

export type DashboardTopModelRow = {
  model: string;
  costUsd: number;
  shareCost: number; // 0..1（costUsd / kpis.costUsd）
  totalTokens: number;
  requestCount: number;
  pricingConfigured?: boolean;
};

export type DashboardPipelineHealth = {
  pending: number;
  running: number;
  failed: number;
  recentFailedJobs: Array<{
    id: string;
    kind: string; // "daily" 等
    rangeFrom: string; // ISO
    rangeTo: string; // ISO
    lastError: string | null;
  }>;
};

export type DashboardSystemHealth = {
  connected: boolean;
  managementBase?: string;
  serverVersion: string | null;
  serverBuildDate: string | null;
};

export type DashboardConfigHealth = {
  apiKeysCount: number | null; // 仅数量，不返回明文/掩码（安全约束）
  providersSummary: {
    geminiCount: number | null;
    codexCount: number | null;
    claudeCount: number | null;
    openaiCompatCount: number | null;
    totalUpstreamKeysCount: number | null; // openaiCompat keys + 其它 provider key entries 的总数（仅数量）
  };
  pricingCoverage: {
    configuredModelsCount: number | null;
    usedModelsCount: number | null;
    missingModelsCount: number | null;
    missingModelsTop: string[] | null; // top 5（v1 建议按成本）
  };
  settingsSummary: {
    usageStatisticsEnabled: boolean | null;
    requestLog: boolean | null;
    wsAuth: boolean | null;
    loggingToFile: boolean | null;
    requestRetry: number | null;
  };
};

export type DashboardActionSeverity = "critical" | "high" | "medium" | "low";
export type DashboardActionKind =
  | "system_disconnected"
  | "pipeline_failed"
  | "pipeline_backlog"
  | "missing_api_keys"
  | "missing_providers"
  | "missing_pricing"
  | "usage_stats_disabled"
  | "cost_concentrated"
  | "view_usage"
  | "view_logs"
  | "view_pipeline"
  | "view_system"
  | "view_settings"
  | "view_pricing";

export type DashboardActionItem = {
  kind: DashboardActionKind;
  severity: DashboardActionSeverity;
  title: string; // i18n key 或直接文案（v1 推荐 i18n key）
  description?: string;
  href: string; // 必须是有效跳转（对齐 AC3）
  primaryActionLabel?: string;
};

export type DashboardPartialError = {
  source: "usage" | "topModels" | "pipeline" | "system" | "config" | "logs";
  code: string; // 内部约定，如 "TIMEOUT" / "MANAGEMENT_ERROR" / "DB_ERROR"
  message: string;
  httpStatus?: number;
  retryable?: boolean;
};

export type DashboardOverviewResponse = {
  request: DashboardOverviewRequest;
  generatedAt: string; // ISO
  kpis: DashboardKpis | null;
  trend: {
    metricDefault: DashboardTrendMetric; // "costUsd"
    buckets: DashboardTrendBucket[] | null; // 点数限制：24-60
  };
  topModels: DashboardTopModelRow[] | null; // Top5
  pipeline: DashboardPipelineHealth | null;
  system: DashboardSystemHealth;
  configHealth: DashboardConfigHealth | null;
  logs:
    | {
        latestTimestamp: string | null;
        lineCount: number | null;
      }
    | null;
  actionCenter: DashboardActionItem[]; // 3-5
  partialErrors: DashboardPartialError[]; // 局部降级可见性
};
