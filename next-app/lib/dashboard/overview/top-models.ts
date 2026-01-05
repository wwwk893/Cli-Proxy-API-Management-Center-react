import "server-only";

import { Prisma, type PrismaClient } from "@prisma/client";

import { CLI_API_PATHS, CODEX_API_PATHS, OPENCODE_API_PATHS } from "@/lib/usage/aggregation-constants";
import type { DashboardChannel, DashboardTopModelRow } from "./types";
import type { DashboardResolvedRange } from "./range";

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function toEventChannelFilter(channel: DashboardChannel) {
  if (channel === "all") return Prisma.sql``;
  return Prisma.sql`AND "sourceType" = ${channel}::text`;
}

export async function queryTopModels(
  prisma: PrismaClient,
  range: DashboardResolvedRange,
  channel: DashboardChannel,
): Promise<DashboardTopModelRow[]> {
  const fromDate = range.from;
  const toDate = range.to;

  const todayStart = startOfUtcDay(new Date());
  const endOfYesterday = new Date(todayStart.getTime() - 1);

  // 仅在 day 粒度且覆盖历史整天时，才用 UsageDaily + UsageEvent 的分界逻辑。
  const useDaily = range.granularity === "day" && fromDate < todayStart;
  const dailyFrom = useDaily ? fromDate : undefined;
  const dailyTo = useDaily ? (toDate < todayStart ? toDate : endOfYesterday) : undefined;

  const includeEvents = !useDaily || toDate >= todayStart;
  const eventFrom = includeEvents ? (useDaily ? todayStart : fromDate) : undefined;
  const eventTo = includeEvents ? toDate : undefined;

  const dailyChannelFilter =
    channel === "codex"
      ? Prisma.sql`AND "apiPath" = ANY(${CODEX_API_PATHS}::text[])`
      : channel === "opencode"
        ? Prisma.sql`AND "apiPath" = ANY(${OPENCODE_API_PATHS}::text[])`
        : channel === "cliproxy"
          ? Prisma.sql`AND NOT ("apiPath" = ANY(${CLI_API_PATHS}::text[]))`
          : Prisma.sql``;

  const channelEventFilter = toEventChannelFilter(channel);

  type Row = {
    model: string;
    totalTokens: bigint;
    costUsd: any;
    requestCount: bigint;
  };

  const [dailyRows, eventRows] = await Promise.all([
    useDaily
      ? prisma.$queryRaw<Row[]>`
          SELECT
            "model" AS model,
            COALESCE(SUM("totalTokens"), 0) AS "totalTokens",
            COALESCE(SUM("costUsd"), 0) AS "costUsd",
            COALESCE(SUM("totalRequests"), 0) AS "requestCount"
          FROM "UsageDaily"
          WHERE
            (${dailyFrom ?? null}::timestamptz IS NULL OR "date" >= ${dailyFrom ?? null}::timestamptz)
            AND (${dailyTo ?? null}::timestamptz IS NULL OR "date" <= ${dailyTo ?? null}::timestamptz)
            ${dailyChannelFilter}
          GROUP BY "model"
        `
      : Promise.resolve([] as Row[]),
    includeEvents
      ? prisma.$queryRaw<Row[]>`
          SELECT
            "model" AS model,
            COALESCE(SUM("totalTokens"), 0) AS "totalTokens",
            COALESCE(SUM("costUsd"), 0) AS "costUsd",
            COUNT(*) AS "requestCount"
          FROM "UsageEvent"
          WHERE
            (${eventFrom ?? null}::timestamptz IS NULL OR "eventTime" >= ${eventFrom ?? null}::timestamptz)
            AND (${eventTo ?? null}::timestamptz IS NULL OR "eventTime" <= ${eventTo ?? null}::timestamptz)
            ${channelEventFilter}
          GROUP BY "model"
        `
      : Promise.resolve([] as Row[]),
  ]);

  const byModel = new Map<string, { model: string; totalTokens: number; costUsd: number; requestCount: number }>();

  const addRow = (row: Row) => {
    const model = row.model || "unknown";
    const current = byModel.get(model) ?? {
      model,
      totalTokens: 0,
      costUsd: 0,
      requestCount: 0,
    };

    byModel.set(model, {
      ...current,
      totalTokens: current.totalTokens + Number(row.totalTokens ?? 0),
      costUsd: current.costUsd + Number(row.costUsd ?? 0),
      requestCount: current.requestCount + Number(row.requestCount ?? 0),
    });
  };

  dailyRows.forEach(addRow);
  eventRows.forEach(addRow);

  const totalCostUsd = Array.from(byModel.values()).reduce((acc, row) => acc + row.costUsd, 0);

  const sorted = Array.from(byModel.values())
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, 5);

  const pricingRows = sorted.length
    ? await prisma.modelPricing.findMany({
        where: { modelId: { in: sorted.map((row) => row.model) } },
        select: { modelId: true },
      })
    : [];
  const configuredSet = new Set(pricingRows.map((row) => row.modelId));

  return sorted.map((row) => ({
    model: row.model,
    costUsd: row.costUsd,
    shareCost: totalCostUsd > 0 ? row.costUsd / totalCostUsd : 0,
    totalTokens: row.totalTokens,
    requestCount: row.requestCount,
    pricingConfigured: configuredSet.has(row.model),
  }));
}
