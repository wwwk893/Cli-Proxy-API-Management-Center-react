import { NextRequest, NextResponse } from "next/server";

import { asAuthError } from "@/lib/auth/errors";
import { requireSession } from "@/lib/auth/session";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseSearchParams, usageByModelQuerySchema } from "@/lib/api";
import { loadPricingMap } from "@/lib/pricing-map";
import { CLI_API_PATHS, CODEX_API_PATHS, OPENCODE_API_PATHS } from "@/lib/usage/aggregation-constants";

const startOfUtcDay = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));

export async function GET(req: NextRequest) {
  try {
    await requireSession();
  } catch (err) {
    const authError = asAuthError(err);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);

  const parsed = parseSearchParams(searchParams, usageByModelQuerySchema);
  if (!parsed.success) {
    return parsed.error;
  }

  const {
    from,
    to,
    apiPath,
    channels = ["cliproxy", "codex", "opencode"],
    sources = [],
    groupBySource = false,
    groupBy = "canonical",
    efforts = [],
  } = parsed.data;

  const codexApiPaths = [...CODEX_API_PATHS];
  const opencodeApiPaths = [...OPENCODE_API_PATHS];
  const cliApiPaths = [...CLI_API_PATHS];
  const includeCodex = channels.includes("codex");
  const includeOpencode = channels.includes("opencode");
  const includeCliproxy = channels.includes("cliproxy");

  const dailyChannelFilter = (() => {
    if (channels.length >= 3) return Prisma.sql``;
    const selectedCliApiPaths = Array.from(
      new Set([
        ...(includeCodex ? codexApiPaths : []),
        ...(includeOpencode ? opencodeApiPaths : []),
      ]),
    );
    if (includeCliproxy) {
      if (!selectedCliApiPaths.length) {
        return Prisma.sql`AND NOT ("apiPath" = ANY(${cliApiPaths}::text[]))`;
      }
      return Prisma.sql`AND ("apiPath" = ANY(${selectedCliApiPaths}::text[]) OR NOT ("apiPath" = ANY(${cliApiPaths}::text[])))`;
    }
    if (selectedCliApiPaths.length) {
      return Prisma.sql`AND "apiPath" = ANY(${selectedCliApiPaths}::text[])`;
    }
    return Prisma.sql`AND FALSE`;
  })();

  const channelEventFilter =
    channels.length < 3 ? Prisma.sql`AND "sourceType" = ANY(${channels}::text[])` : Prisma.sql``;

  const sourceFilter = sources.length
    ? Prisma.sql`AND "authSource" = ANY(${sources}::text[])`
    : Prisma.sql``;

  const effortFilter = (() => {
    if (groupBy === "raw") return Prisma.sql``;
    if (!efforts.length) return Prisma.sql``;

    const includeUnspecified = efforts.includes("unspecified");
    const selected = efforts.filter((e) => e !== "unspecified");

    if (includeUnspecified && selected.length) {
      return Prisma.sql`AND ("effort" = ANY(${selected}::text[]) OR "effort" IS NULL)`;
    }
    if (includeUnspecified) {
      return Prisma.sql`AND "effort" IS NULL`;
    }
    return Prisma.sql`AND "effort" = ANY(${selected}::text[])`;
  })();

  try {
    const fromDate = from ? new Date(from) : undefined;
    const toDate = to ? new Date(to) : undefined;
    const todayStart = startOfUtcDay(new Date());
    const endOfYesterday = new Date(todayStart.getTime() - 1);

    const useDaily = fromDate ? fromDate < todayStart : true;
    const dailyFrom = useDaily ? fromDate : undefined;
    const dailyTo = useDaily ? (toDate && toDate < todayStart ? toDate : endOfYesterday) : undefined;

    const includeEvents = !useDaily || (toDate ? toDate >= todayStart : true);
    const eventFrom = includeEvents ? (useDaily ? todayStart : fromDate) : undefined;
    const eventTo = includeEvents ? toDate : undefined;

    type DailyRow = {
      model: string;
      modelRaw: string | null;
      modelCanonical: string | null;
      effort: string | null;
      authSource: string | null;
      inputTokens: bigint;
      outputTokens: bigint;
      reasoningTokens: bigint;
      cachedTokens: bigint;
      codexInputTokens: bigint;
      codexOutputTokens: bigint;
      codexReasoningTokens: bigint;
      codexCachedTokens: bigint;
      totalTokens: bigint;
      costUsd: any;
      requestCount: bigint;
      pricingModelIds: string[] | null;
    };

    type EventRow = DailyRow & { failureCount: bigint };

    const dailyModelKeySql =
      groupBy === "raw"
        ? Prisma.sql`"model"`
        : Prisma.sql`COALESCE("modelCanonical", "model")`;
    const eventModelKeySql =
      groupBy === "raw"
        ? Prisma.sql`COALESCE("modelRaw", "model")`
        : Prisma.sql`COALESCE("modelCanonical", "model")`;

    const dailyEffortSql = groupBy === "canonical_effort" ? Prisma.sql`"effort"` : Prisma.sql`NULL`;
    const eventEffortSql = groupBy === "canonical_effort" ? Prisma.sql`"effort"` : Prisma.sql`NULL`;

    const dailyModelCanonicalSql =
      groupBy === "raw"
        ? Prisma.sql`MAX(COALESCE("modelCanonical", "model"))`
        : Prisma.sql`${dailyModelKeySql}`;
    const eventModelCanonicalSql =
      groupBy === "raw"
        ? Prisma.sql`MAX(COALESCE("modelCanonical", "model"))`
        : Prisma.sql`${eventModelKeySql}`;

    const dailyModelRawSql = groupBy === "raw" ? Prisma.sql`"model"` : Prisma.sql`NULL`;
    const eventModelRawSql = groupBy === "raw" ? Prisma.sql`COALESCE("modelRaw", "model")` : Prisma.sql`NULL`;

    const dailyRowsPromise: Promise<DailyRow[]> = useDaily
      ? prisma.$queryRaw<DailyRow[]>`
            SELECT
              ${dailyModelKeySql} AS model,
              ${dailyModelRawSql} AS "modelRaw",
              ${dailyModelCanonicalSql} AS "modelCanonical",
              ${dailyEffortSql} AS "effort",
              ${groupBySource ? Prisma.sql`"authSource"` : Prisma.sql`NULL`} AS "authSource",
              SUM("inputTokens") AS "inputTokens",
              SUM("outputTokens") AS "outputTokens",
              SUM("reasoningTokens") AS "reasoningTokens",
              SUM("cachedTokens") AS "cachedTokens",
              SUM(CASE WHEN "apiPath" = ANY(${codexApiPaths}::text[]) THEN "inputTokens" ELSE 0 END) AS "codexInputTokens",
              SUM(CASE WHEN "apiPath" = ANY(${codexApiPaths}::text[]) THEN "outputTokens" ELSE 0 END) AS "codexOutputTokens",
              SUM(CASE WHEN "apiPath" = ANY(${codexApiPaths}::text[]) THEN "reasoningTokens" ELSE 0 END) AS "codexReasoningTokens",
              SUM(CASE WHEN "apiPath" = ANY(${codexApiPaths}::text[]) THEN "cachedTokens" ELSE 0 END) AS "codexCachedTokens",
              SUM("totalTokens") AS "totalTokens",
              SUM("costUsd") AS "costUsd",
              SUM("totalRequests") AS "requestCount",
              ARRAY_AGG(DISTINCT "model") AS "pricingModelIds"
            FROM "UsageDaily"
            WHERE
              (${dailyFrom ?? null}::timestamptz IS NULL OR "date" >= ${dailyFrom ?? null}::timestamptz)
              AND (${dailyTo ?? null}::timestamptz IS NULL OR "date" <= ${dailyTo ?? null}::timestamptz)
              AND (${apiPath ?? null}::text IS NULL OR "apiPath" = ${apiPath ?? null})
              ${dailyChannelFilter}
              ${sourceFilter}
              ${effortFilter}
            GROUP BY ${dailyModelKeySql}
              ${groupBy === "canonical_effort" ? Prisma.sql`, "effort"` : Prisma.sql``}
              ${groupBySource ? Prisma.sql`, "authSource"` : Prisma.sql``}
            ORDER BY ${dailyModelKeySql}
              ${groupBy === "canonical_effort" ? Prisma.sql`, "effort"` : Prisma.sql``}
              ${groupBySource ? Prisma.sql`, "authSource"` : Prisma.sql``}
          `
      : Promise.resolve([] as DailyRow[]);

    const eventRowsPromise: Promise<EventRow[]> = includeEvents
      ? prisma.$queryRaw<EventRow[]>`
            SELECT
              ${eventModelKeySql} AS model,
              ${eventModelRawSql} AS "modelRaw",
              ${eventModelCanonicalSql} AS "modelCanonical",
              ${eventEffortSql} AS "effort",
              ${groupBySource ? Prisma.sql`"authSource"` : Prisma.sql`NULL`} AS "authSource",
              SUM("inputTokens") AS "inputTokens",
              SUM("outputTokens") AS "outputTokens",
              SUM("reasoningTokens") AS "reasoningTokens",
              SUM("cachedTokens") AS "cachedTokens",
              SUM(CASE WHEN "apiPath" = ANY(${codexApiPaths}::text[]) THEN "inputTokens" ELSE 0 END) AS "codexInputTokens",
              SUM(CASE WHEN "apiPath" = ANY(${codexApiPaths}::text[]) THEN "outputTokens" ELSE 0 END) AS "codexOutputTokens",
              SUM(CASE WHEN "apiPath" = ANY(${codexApiPaths}::text[]) THEN "reasoningTokens" ELSE 0 END) AS "codexReasoningTokens",
              SUM(CASE WHEN "apiPath" = ANY(${codexApiPaths}::text[]) THEN "cachedTokens" ELSE 0 END) AS "codexCachedTokens",
              SUM("totalTokens") AS "totalTokens",
              SUM("costUsd") AS "costUsd",
              COUNT(*) AS "requestCount",
              SUM(CASE WHEN "status" IS NOT NULL AND LOWER("status") NOT IN ('200', 'ok', 'completed') THEN 1 ELSE 0 END) AS "failureCount",
              ARRAY_AGG(DISTINCT COALESCE("modelRaw", "model")) AS "pricingModelIds"
            FROM "UsageEvent"
            WHERE
              (${eventFrom ?? null}::timestamptz IS NULL OR "eventTime" >= ${eventFrom ?? null}::timestamptz)
              AND (${eventTo ?? null}::timestamptz IS NULL OR "eventTime" <= ${eventTo ?? null}::timestamptz)
              AND (${apiPath ?? null}::text IS NULL OR "apiPath" = ${apiPath ?? null})
              ${channelEventFilter}
              ${sourceFilter}
              ${effortFilter}
            GROUP BY ${eventModelKeySql}
              ${groupBy === "canonical_effort" ? Prisma.sql`, "effort"` : Prisma.sql``}
              ${groupBySource ? Prisma.sql`, "authSource"` : Prisma.sql``}
            ORDER BY ${eventModelKeySql}
              ${groupBy === "canonical_effort" ? Prisma.sql`, "effort"` : Prisma.sql``}
              ${groupBySource ? Prisma.sql`, "authSource"` : Prisma.sql``}
          `
      : Promise.resolve([] as EventRow[]);

    const [dailyRows, eventRows, pricingRows, pricingMap] = await Promise.all([
      dailyRowsPromise,
      eventRowsPromise,
      prisma.modelPricing.findMany({ select: { modelId: true } }),
      loadPricingMap(),
    ]);
    const configuredSet = new Set(pricingRows.map((row: any) => row.modelId));

    const map = new Map<
      string,
      {
        model: string;
        modelRaw: string | null;
        modelCanonical: string | null;
        effort: string | null;
        authSource: string | null;
        totalTokens: number;
        cachedTokens: number;
        inputTokens: number;
        outputTokens: number;
        reasoningTokens: number;
        codexInputTokens: number;
        codexOutputTokens: number;
        codexReasoningTokens: number;
        codexCachedTokens: number;
        costUsd: number;
        inputCostUsd: number | null;
        outputCostUsd: number | null;
        cachedCostUsd: number | null;
        pricingConfigured: boolean;
        pricingConflict: boolean;
        pricingModelIds: string[];
        requestCount: number;
        failureCount: number;
      }
    >();

    const addRow = (row: {
      model: string;
      modelRaw: string | null;
      modelCanonical: string | null;
      effort: string | null;
      authSource: string | null;
      inputTokens: bigint;
      outputTokens: bigint;
      reasoningTokens: bigint;
      cachedTokens: bigint;
      codexInputTokens: bigint;
      codexOutputTokens: bigint;
      codexReasoningTokens: bigint;
      codexCachedTokens: bigint;
      totalTokens: bigint;
      costUsd: any;
      requestCount: bigint;
      pricingModelIds?: string[] | null;
      failureCount?: bigint;
    }) => {
      const key = `${row.model}::${row.effort ?? ""}::${row.authSource ?? ""}`;
      const rowPricingIds = Array.isArray(row.pricingModelIds)
        ? row.pricingModelIds.map((v) => String(v)).filter((v) => v.trim().length > 0)
        : [];
      const current =
        map.get(key) ??
        ({
          model: row.model,
          modelRaw: row.modelRaw,
          modelCanonical: row.modelCanonical,
          effort: row.effort,
          authSource: row.authSource,
          totalTokens: 0,
          cachedTokens: 0,
          inputTokens: 0,
          outputTokens: 0,
          reasoningTokens: 0,
          codexInputTokens: 0,
          codexOutputTokens: 0,
          codexReasoningTokens: 0,
          codexCachedTokens: 0,
          costUsd: 0,
          inputCostUsd: null,
          outputCostUsd: null,
          cachedCostUsd: null,
          pricingConfigured: false,
          pricingConflict: false,
          pricingModelIds: [],
          requestCount: 0,
          failureCount: 0,
        });

      const pricingIdSet = new Set([...(current.pricingModelIds ?? []), ...rowPricingIds]);

      map.set(key, {
        ...current,
        modelRaw: row.modelRaw ?? current.modelRaw,
        modelCanonical: row.modelCanonical ?? current.modelCanonical,
        effort: row.effort ?? current.effort,
        pricingModelIds: Array.from(pricingIdSet),
        totalTokens: current.totalTokens + Number(row.totalTokens ?? 0),
        cachedTokens: current.cachedTokens + Number(row.cachedTokens ?? 0),
        inputTokens: current.inputTokens + Number(row.inputTokens ?? 0),
        outputTokens: current.outputTokens + Number(row.outputTokens ?? 0),
        reasoningTokens: current.reasoningTokens + Number(row.reasoningTokens ?? 0),
        codexInputTokens: current.codexInputTokens + Number(row.codexInputTokens ?? 0),
        codexOutputTokens: current.codexOutputTokens + Number(row.codexOutputTokens ?? 0),
        codexReasoningTokens: current.codexReasoningTokens + Number(row.codexReasoningTokens ?? 0),
        codexCachedTokens: current.codexCachedTokens + Number(row.codexCachedTokens ?? 0),
        costUsd: current.costUsd + Number(row.costUsd ?? 0),
        requestCount: current.requestCount + Number(row.requestCount ?? 0),
        failureCount: current.failureCount + Number(row.failureCount ?? 0),
      });
    };

    dailyRows.forEach((row: any) => addRow(row));
    eventRows.forEach((row: any) => addRow(row));

    const round6 = (value: number) => Math.round(value * 1_000_000) / 1_000_000;

    const data = Array.from(map.values())
      .map((row) => {
        const { codexInputTokens, codexOutputTokens, codexReasoningTokens, codexCachedTokens, ...rest } = row;
        const cacheHitRate = row.totalTokens > 0 ? row.cachedTokens / row.totalTokens : 0;
        const pricingIds = Array.isArray(row.pricingModelIds) && row.pricingModelIds.length
          ? row.pricingModelIds
          : [row.model];
        const resolved = resolvePricing({ pricingIds, configuredSet, pricingMap });

        const gatewayInputTokens = Math.max(0, row.inputTokens - row.codexInputTokens);
        const gatewayOutputTokens = Math.max(0, row.outputTokens - row.codexOutputTokens);
        const gatewayReasoningTokens = Math.max(0, row.reasoningTokens - row.codexReasoningTokens);

        const billableInputTokens = Math.max(0, row.codexInputTokens - row.codexCachedTokens) + gatewayInputTokens;
        const billableOutputTokens = row.codexOutputTokens + gatewayOutputTokens + gatewayReasoningTokens;

        const inputCostUsd = resolved.pricing
          ? round6((billableInputTokens / 1_000_000) * resolved.pricing.inputRate)
          : null;
        const outputCostUsd = resolved.pricing
          ? round6((billableOutputTokens / 1_000_000) * resolved.pricing.outputRate)
          : null;
        const cachedCostUsd = resolved.pricing
          ? round6((row.cachedTokens / 1_000_000) * resolved.pricing.cachedRate)
          : null;

        return {
          ...rest,
          cacheHitRate,
          pricingConfigured: resolved.pricingConfigured,
          pricingConflict: resolved.pricingConflict,
          pricingModelIds: pricingIds,
          inputCostUsd,
          outputCostUsd,
          cachedCostUsd,
        };
      })
      .sort((a, b) => {
        const modelDiff = a.model.localeCompare(b.model);
        if (modelDiff !== 0) return modelDiff;
        const effortDiff = (a.effort ?? "").localeCompare(b.effort ?? "");
        if (effortDiff !== 0) return effortDiff;
        return (a.authSource ?? "").localeCompare(b.authSource ?? "");
      });

    return NextResponse.json({
      data,
      meta: {
        groupBy,
        effortsApplied: groupBy === "raw" ? [] : efforts,
        usedDaily: useDaily,
        usedEvents: includeEvents,
      },
    });
  } catch (err) {
    console.error("Usage by-model API error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function resolvePricing(params: {
  pricingIds: string[];
  configuredSet: Set<string>;
  pricingMap: Record<string, any>;
}) {
  const { pricingIds, configuredSet, pricingMap } = params;
  const uniqueIds = Array.from(new Set(pricingIds.map((v) => String(v)).filter((v) => v.trim().length > 0)));
  if (!uniqueIds.length) {
    return { pricingConfigured: false, pricingConflict: false, pricing: null as null | { inputRate: number; outputRate: number; cachedRate: number } };
  }

  const resolved = uniqueIds.map((id) => {
    const pricingConfigured = configuredSet.has(id);
    const pricing = pricingMap[id];
    const inputRate = pricing ? Number(pricing.inputPerMillion) : Number.NaN;
    const outputRate = pricing ? Number(pricing.outputPerMillion) : Number.NaN;
    const cachedRate = pricing ? Number(pricing.cachedPerMillion) : Number.NaN;
    const ready =
      pricingConfigured &&
      Number.isFinite(inputRate) &&
      Number.isFinite(outputRate) &&
      Number.isFinite(cachedRate);
    return { id, ready, inputRate, outputRate, cachedRate };
  });

  const ready = resolved.filter((r) => r.ready);
  if (ready.length === 0) {
    return { pricingConfigured: false, pricingConflict: false, pricing: null as null };
  }

  // if some missing/invalid -> conflict (in canonical aggregation this usually indicates mixed configs)
  if (ready.length !== resolved.length) {
    return { pricingConfigured: false, pricingConflict: resolved.length > 1, pricing: null as null };
  }

  const first = ready[0];
  const same = ready.every(
    (r) => r.inputRate === first.inputRate && r.outputRate === first.outputRate && r.cachedRate === first.cachedRate,
  );
  if (!same) {
    return { pricingConfigured: false, pricingConflict: true, pricing: null as null };
  }

  return {
    pricingConfigured: true,
    pricingConflict: false,
    pricing: { inputRate: first.inputRate, outputRate: first.outputRate, cachedRate: first.cachedRate },
  };
}
