import crypto from "crypto";
import { Prisma } from "@prisma/client";

import { AGGREGATION_CHANNELS, CODEX_API_PATHS, AggregationChannel } from "./aggregation-constants";

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
    const channel = normalized.channels[0];
    if (channel === "codex") {
      where.apiPath = { in: [...CODEX_API_PATHS] };
    } else {
      where.NOT = { apiPath: { in: [...CODEX_API_PATHS] } };
    }
  }
  return where;
};

export const buildUsageEventFilterSql = (filters?: AggregationFilters, tableAlias?: string) => {
  const normalized = normalizeAggregationFilters(filters);
  if (!normalized) return Prisma.sql``;

  const modelColumn = Prisma.raw(tableAlias ? `${tableAlias}."model"` : `"model"`);
  const apiPathColumn = Prisma.raw(tableAlias ? `${tableAlias}."apiPath"` : `"apiPath"`);
  const conditions: Prisma.Sql[] = [];

  if (normalized.models?.length) {
    conditions.push(Prisma.sql`${modelColumn} = ANY(${normalized.models}::text[])`);
  }

  if (normalized.channels?.length === 1) {
    const channel = normalized.channels[0];
    if (channel === "codex") {
      conditions.push(Prisma.sql`${apiPathColumn} = ANY(${CODEX_API_PATHS}::text[])`);
    } else {
      conditions.push(Prisma.sql`NOT (${apiPathColumn} = ANY(${CODEX_API_PATHS}::text[]))`);
    }
  }

  if (!conditions.length) return Prisma.sql``;
  return Prisma.sql`AND ${Prisma.join(conditions, Prisma.sql` AND `)}`;
};
