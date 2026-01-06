import { Prisma } from "@prisma/client";

import { prisma } from "./db";
import { CODEX_API_PATHS } from "./usage/aggregation-constants";
import { AggregationFilters, buildUsageEventFilterSql } from "./usage/aggregation-filters";

export type AggregateJobPayload = {
  kind: "daily";
  rangeFrom: Date;
  rangeTo: Date;
  filters?: AggregationFilters;
};

export type AggregateResult = {
  rowsAffected: number;
};

export async function backfillUsageEventCost(payload: AggregateJobPayload): Promise<AggregateResult> {
  const { rangeFrom, rangeTo, filters } = payload;
  const filterSql = buildUsageEventFilterSql(filters, "e");

  // 价格变更后回填 costUsd：仅更新已有定价且 costUsd=0 的事件
  // 说明：Gateway 使用 input/output+reasoning/cached 计费；Codex 使用 (input-cached)+output+caches 计费（reasoning 不计费）。
  const codexApiPaths = [...CODEX_API_PATHS];
  const result = await prisma.$executeRaw<number>(
    Prisma.sql`
      UPDATE "UsageEvent" AS e
      SET "costUsd" = ROUND(
        (
          (CASE
            WHEN e."apiPath" = ANY(${codexApiPaths}::text[])
              THEN GREATEST(0, e."inputTokens" - COALESCE(e."cachedTokens", 0))
            ELSE e."inputTokens"
          END)::numeric / 1000000.0 * p."inputCost"
        )
        +
        (
          (CASE
            WHEN e."apiPath" = ANY(${codexApiPaths}::text[])
              THEN e."outputTokens"
            ELSE e."outputTokens" + COALESCE(e."reasoningTokens", 0)
          END)::numeric / 1000000.0 * p."outputCost"
        )
        +
        (
          COALESCE(e."cachedTokens", 0)::numeric / 1000000.0 * p."cachedCost"
        )
      , 6)
      FROM "ModelPricing" AS p
      WHERE
        p."modelId" = e."model"
        AND e."eventTime" >= ${rangeFrom}
        AND e."eventTime" <= ${rangeTo}
        ${filterSql}
        AND (e."costUsd" = 0 OR e."costUsd" IS NULL);
    `,
  );

  return { rowsAffected: typeof result === "number" ? result : 0 };
}

export async function runUsageDailyAggregation(payload: AggregateJobPayload): Promise<AggregateResult> {
  const { rangeFrom, rangeTo, filters } = payload;
  const filterSql = buildUsageEventFilterSql(filters);

  await backfillUsageEventCost(payload);

  // Single-shot upsert of the whole day; relies on UsageDaily composite unique key
  const result = await prisma.$executeRaw<number>(
    Prisma.sql`
    INSERT INTO "UsageDaily" (
      "id",
      "date", "apiPath", "model", "modelCanonical", "effort", "proxyHost", "authSource", "authIndex", "authFailed",
      "totalRequests", "inputTokens", "outputTokens", "reasoningTokens", "cachedTokens", "totalTokens", "costUsd"
    )
    SELECT
      gen_random_uuid(),
      date_trunc('day', "eventTime") as "date",
      "apiPath",
      "model",
      COALESCE("modelCanonical", "model") AS "modelCanonical",
      "effort",
      "proxyHost",
      "authSource",
      "authIndex",
      "authFailed",
      COUNT(*) as "totalRequests",
      SUM("inputTokens"),
      SUM("outputTokens"),
      SUM("reasoningTokens"),
      SUM("cachedTokens"),
      SUM("totalTokens"),
      SUM("costUsd")
    FROM "UsageEvent"
    WHERE "eventTime" >= ${rangeFrom} AND "eventTime" <= ${rangeTo}
    ${filterSql}
    GROUP BY 2,3,4,5,6,7,8,9,10
    ON CONFLICT (
      "date",
      "apiPath",
      "model",
      COALESCE("effort", ''),
      COALESCE("proxyHost", ''),
      COALESCE("authSource", ''),
      COALESCE("authIndex", -1),
      COALESCE("authFailed", false)
    )
    DO UPDATE SET
      "modelCanonical"  = EXCLUDED."modelCanonical",
      "effort"          = EXCLUDED."effort",
      "totalRequests"   = EXCLUDED."totalRequests",
      "inputTokens"     = EXCLUDED."inputTokens",
      "outputTokens"    = EXCLUDED."outputTokens",
      "reasoningTokens" = EXCLUDED."reasoningTokens",
      "cachedTokens"    = EXCLUDED."cachedTokens",
      "totalTokens"     = EXCLUDED."totalTokens",
      "costUsd"         = EXCLUDED."costUsd";
    `,
  );

  return { rowsAffected: typeof result === "number" ? result : 0 };
}
