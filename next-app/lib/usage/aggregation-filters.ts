import crypto from "crypto";
import { Prisma } from "@prisma/client";

import { AGGREGATION_CHANNELS, AggregationChannel } from "./aggregation-constants";

export type AggregationFilters = {
  models?: string[];
  channels?: AggregationChannel[];
} | null | undefined;

type NormalizeOptions = {
  allModels?: string[];
};

const normalizeStringArray = (values?: string[]) => {
  if (!values?.length) return undefined;
  const cleaned = values.map((v) => v.trim()).filter((v) => v.length > 0);
  if (!cleaned.length) return undefined;
  const unique = Array.from(new Set(cleaned));
  unique.sort();
  return unique;
};

export const normalizeAggregationFilters = (filters?: AggregationFilters, options?: NormalizeOptions) => {
  if (!filters) return undefined;
  let models = normalizeStringArray(filters.models);
  const allModels = normalizeStringArray(options?.allModels);
  if (models && allModels && models.length === allModels.length && models.every((model, index) => model === allModels[index])) {
    models = undefined;
  }
  let channels = normalizeStringArray(filters.channels) as AggregationChannel[] | undefined;
  if (channels && channels.length === AGGREGATION_CHANNELS.length) {
    channels = undefined;
  }
  const normalized: { models?: string[]; channels?: AggregationChannel[] } = {};
  if (models?.length) normalized.models = models;
  if (channels?.length) normalized.channels = channels;
  return Object.keys(normalized).length ? normalized : undefined;
};

export const buildFiltersHash = (filters?: AggregationFilters, options?: NormalizeOptions) => {
  const normalized = normalizeAggregationFilters(filters, options);
  if (!normalized) {
    return { hash: "all", normalized: undefined as AggregationFilters };
  }
  const canonical = JSON.stringify({
    models: normalized.models ?? [],
    channels: normalized.channels ?? [],
  });
  const hash = crypto.createHash("sha256").update(canonical).digest("hex");
  return { hash, normalized };
};

export const buildUsageEventWhere = (filters?: AggregationFilters): Prisma.UsageEventWhereInput => {
  const normalized = normalizeAggregationFilters(filters);
  const where: Prisma.UsageEventWhereInput = {};
  if (normalized?.models?.length) {
    where.model = { in: normalized.models };
  }
  if (normalized?.channels?.length === 1) {
    where.sourceType = normalized.channels[0];
  } else if (normalized?.channels?.length) {
    where.sourceType = { in: normalized.channels };
  }
  return where;
};

export const buildUsageEventFilterSql = (filters?: AggregationFilters, tableAlias?: string) => {
  const normalized = normalizeAggregationFilters(filters);
  if (!normalized) return Prisma.sql``;

  const modelColumn = Prisma.raw(tableAlias ? `${tableAlias}."model"` : `"model"`);
  const sourceTypeColumn = Prisma.raw(tableAlias ? `${tableAlias}."sourceType"` : `"sourceType"`);
  const conditions: Prisma.Sql[] = [];

  if (normalized.models?.length) {
    conditions.push(Prisma.sql`${modelColumn} = ANY(${normalized.models}::text[])`);
  }

  if (normalized.channels?.length) {
    conditions.push(Prisma.sql`${sourceTypeColumn} = ANY(${normalized.channels}::text[])`);
  }

  if (!conditions.length) return Prisma.sql``;
  return Prisma.sql`AND ${Prisma.join(conditions, " AND ")}`;
};
