import { z } from "zod";

// Common schemas
export const isoDateStringSchema = z.string().datetime().optional().nullable();

export const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

// Dashboard overview API schemas
export const dashboardTimeWindowSchema = z
  .enum(["utc-today", "last-24h", "last-7d", "last-30d"])
  .default("last-24h");

export const dashboardChannelSchema = z.enum(["all", "cliproxy", "codex", "opencode"]).default("all");

export const dashboardOverviewQuerySchema = z.object({
  timeWindow: dashboardTimeWindowSchema,
  channel: dashboardChannelSchema,
});

// Usage API schemas
export const granularitySchema = z.enum(["second", "minute", "hour", "day"]).default("day");
export const viewModeSchema = z
  .enum(["aggregate", "per-model", "source", "source-model", "channel", "channel-model"])
  .default("aggregate");
export const dimensionSchema = z
  .enum(["model", "source", "model+source", "overall", "channel", "model+channel"])
  .default("model");

const stringOrStringArray = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((val) => {
    if (!val) return [] as string[];
    return Array.isArray(val) ? val : [val];
  });

const channelValueSchema = z.enum(["cliproxy", "codex", "opencode"]);
const channelOrChannelArray = z
  .union([channelValueSchema, z.array(channelValueSchema)])
  .optional()
  .transform((val) => {
    if (!val) return ["cliproxy", "codex", "opencode"];
    const arr = Array.isArray(val) ? val : [val];
    const unique = Array.from(new Set(arr));
    return unique.length ? unique : ["cliproxy", "codex", "opencode"];
  });

const aggregationFiltersSchema = z
  .object({
    models: z.array(z.string().min(1)).optional(),
    channels: z.array(channelValueSchema).optional(),
  })
  .optional()
  .transform((val) => {
    if (!val) return undefined;
    const models = Array.isArray(val.models) ? val.models.filter((m) => m.trim().length > 0) : undefined;
    const channels = Array.isArray(val.channels) ? val.channels : undefined;
    if (!models?.length && !channels?.length) return undefined;
    return {
      ...(models?.length ? { models } : {}),
      ...(channels?.length ? { channels } : {}),
    };
  });

// Aggregation job schemas
const statusStringOrArray = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((val) => {
    if (!val) return [] as string[];
    const arr = Array.isArray(val) ? val : val.split(",");
    return arr.filter((s) => s.trim().length > 0);
  });

export const usageJobListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  status: statusStringOrArray,
  kind: z.string().optional(),
  from: isoDateStringSchema,
  to: isoDateStringSchema,
});

export const usageJobCreateSchema = z.object({
  kind: z.literal("daily").optional().default("daily"),
  from: isoDateStringSchema,
  to: isoDateStringSchema,
  force: z.coerce.boolean().optional().default(false),
  filters: aggregationFiltersSchema,
});

export const usageCostBackfillSchema = z.object({}).strict();

export const usageJobRetrySchema = z.object({
  force: z.coerce.boolean().optional().default(false),
});

export const usageJobBatchRetrySchema = z.object({
  jobIds: z.array(z.string().min(1)).min(1),
  force: z.coerce.boolean().optional().default(false),
});

export const usageJobRunSchema = z.object({
  limit: z.coerce.number().int().positive().max(50).default(10),
});

export const usageAggregateEarliestSchema = z.object({
  filters: aggregationFiltersSchema,
});

export const usageQuerySchema = z.object({
  from: isoDateStringSchema,
  to: isoDateStringSchema,
  model: stringOrStringArray.default([]),
  apiPath: z.string().optional().nullable(),
  granularity: granularitySchema,
  view: viewModeSchema,
  channels: channelOrChannelArray,
  sources: stringOrStringArray.default([]),
  groupBySource: z.coerce.boolean().optional().default(false),
  dimension: dimensionSchema.optional().default("model"),
});

export const usageByModelQuerySchema = z.object({
  from: isoDateStringSchema,
  to: isoDateStringSchema,
  apiPath: z.string().optional().nullable(),
  channels: channelOrChannelArray,
  sources: stringOrStringArray.default([]),
  groupBySource: z.coerce.boolean().optional().default(false),
});

// Sessions API schemas
export const usageSessionsQuerySchema = z.object({
  from: isoDateStringSchema,
  to: isoDateStringSchema,
  channels: channelOrChannelArray,
  model: stringOrStringArray.default([]),
  originator: stringOrStringArray.default([]),
  deviceId: stringOrStringArray.default([]),
  cwd: stringOrStringArray.default([]),
  effort: stringOrStringArray.default([]),
  q: z.string().optional().nullable(),
  limit: z.coerce.number().int().positive().max(200).optional().default(50),
  offset: z.coerce.number().int().nonnegative().optional().default(0),
  sortBy: z
    .enum(["lastActivity", "costUsd", "totalTokens", "durationMs", "turns"])
    .optional()
    .default("lastActivity"),
  sortDir: z.enum(["asc", "desc"]).optional().default("desc"),
  includeFacets: z.coerce.boolean().optional().default(false),
});

export const usageSessionEventsQuerySchema = z.object({
  from: isoDateStringSchema,
  to: isoDateStringSchema,
  channels: channelOrChannelArray,
  limit: z.coerce.number().int().positive().max(1000).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

// Model Pricing API schemas
export const modelPricingCreateSchema = z.object({
  modelId: z.string().min(1, "modelId is required").trim(),
  inputCost: z.coerce.number().nonnegative("inputCost must be a non-negative number"),
  outputCost: z.coerce.number().nonnegative("outputCost must be a non-negative number"),
  cachedCost: z.coerce.number().nonnegative("cachedCost must be a non-negative number").default(0),
});

export const modelPricingDeleteSchema = z.object({
  modelId: z.string().min(1, "modelId is required").trim(),
});

// Usage Ingest API schemas
export const usageIngestQuerySchema = z.object({
  since: z.string().datetime().optional().nullable(),
  max: z.coerce.number().int().positive().optional(),
  dryRun: z
    .string()
    .optional()
    .transform((val) => (val === "true" ? true : val === "false" ? false : undefined)),
});

// Type exports
export type DashboardOverviewQuery = z.infer<typeof dashboardOverviewQuerySchema>;
export type UsageQuery = z.infer<typeof usageQuerySchema>;
export type UsageByModelQuery = z.infer<typeof usageByModelQuerySchema>;
export type UsageSessionsQuery = z.infer<typeof usageSessionsQuerySchema>;
export type UsageSessionEventsQuery = z.infer<typeof usageSessionEventsQuerySchema>;
export type ModelPricingCreate = z.infer<typeof modelPricingCreateSchema>;
export type ModelPricingDelete = z.infer<typeof modelPricingDeleteSchema>;
export type UsageIngestQuery = z.infer<typeof usageIngestQuerySchema>;
export type Granularity = z.infer<typeof granularitySchema>;
export type UsageAggregateFilters = z.infer<typeof aggregationFiltersSchema>;
export type ViewMode = z.infer<typeof viewModeSchema>;
export type Dimension = z.infer<typeof dimensionSchema>;
