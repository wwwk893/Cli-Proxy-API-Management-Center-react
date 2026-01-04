import "server-only";

import { Prisma, type PrismaClient } from "@prisma/client";

import { CODEX_API_PATHS } from "@/lib/usage/aggregation-constants";
import type { DashboardChannel, DashboardKpis, DashboardTrendBucket } from "./types";
import type { DashboardResolvedRange } from "./range";

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function startOfUtcHour(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), 0, 0, 0));
}

function nextBucket(date: Date, granularity: "hour" | "day") {
  return new Date(date.getTime() + (granularity === "hour" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000));
}

function buildBucketTimeline(range: DashboardResolvedRange): Date[] {
  const start = range.granularity === "hour" ? startOfUtcHour(range.from) : startOfUtcDay(range.from);
  const end = range.granularity === "hour" ? startOfUtcHour(range.to) : startOfUtcDay(range.to);

  const buckets: Date[] = [];
  let cursor = start;
  while (cursor.getTime() <= end.getTime()) {
    buckets.push(cursor);
    cursor = nextBucket(cursor, range.granularity);
    if (buckets.length > 60) {
      break;
    }
  }
  return buckets;
}

function toEventChannelFilter(channel: DashboardChannel) {
  if (channel === "all") return Prisma.sql``;
  return Prisma.sql`AND "sourceType" = ${channel}::text`;
}

function normalizeBucket(value: Date | string) {
  if (value instanceof Date) return value.toISOString();

  const raw = String(value).trim();
  const isoLike = raw.includes(" ") ? raw.replace(" ", "T") : raw;

  // Postgres `timestamp` (no tz) often arrives without timezone info.
  // Our dashboard ranges/timelines are UTC-based, so interpret such strings as UTC.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(isoLike)) {
    return new Date(`${isoLike}Z`).toISOString();
  }

  return new Date(raw).toISOString();
}

export async function queryOverviewUsage(
  prisma: PrismaClient,
  range: DashboardResolvedRange,
  channel: DashboardChannel,
): Promise<{ kpis: DashboardKpis; trendBuckets: DashboardTrendBucket[] }> {
  const fromDate = range.from;
  const toDate = range.to;

  const todayStart = startOfUtcDay(new Date());
  const endOfYesterday = new Date(todayStart.getTime() - 1);

  const useDaily = range.granularity === "day" && fromDate < todayStart;
  const dailyFrom = useDaily ? fromDate : undefined;
  const dailyTo = useDaily ? (toDate < todayStart ? toDate : endOfYesterday) : undefined;

  const includeEvents = !useDaily || toDate >= todayStart;
  const eventFrom = includeEvents ? (useDaily ? todayStart : fromDate) : undefined;
  const eventTo = includeEvents ? toDate : undefined;

  const codexDailyFilter =
    channel === "codex"
      ? Prisma.sql`AND "apiPath" = ANY(${CODEX_API_PATHS}::text[])`
      : channel === "cliproxy"
        ? Prisma.sql`AND NOT ("apiPath" = ANY(${CODEX_API_PATHS}::text[]))`
        : Prisma.sql``;

  const channelEventFilter = toEventChannelFilter(channel);

  type DailyKpiRow = {
    totalTokens: bigint;
    cachedTokens: bigint;
    costUsd: any;
    requestCount: bigint;
  };

  type EventKpiRow = DailyKpiRow & {
    latestEventTime: Date | null;
  };

  const [dailyKpi, eventKpi] = await Promise.all([
    useDaily
      ? prisma.$queryRaw<DailyKpiRow[]>`
          SELECT
            COALESCE(SUM("totalTokens"), 0) AS "totalTokens",
            COALESCE(SUM("cachedTokens"), 0) AS "cachedTokens",
            COALESCE(SUM("costUsd"), 0) AS "costUsd",
            COALESCE(SUM("totalRequests"), 0) AS "requestCount"
          FROM "UsageDaily"
          WHERE
            (${dailyFrom ?? null}::timestamptz IS NULL OR "date" >= ${dailyFrom ?? null}::timestamptz)
            AND (${dailyTo ?? null}::timestamptz IS NULL OR "date" <= ${dailyTo ?? null}::timestamptz)
            ${codexDailyFilter}
        `
      : Promise.resolve([] as DailyKpiRow[]),
    includeEvents
      ? prisma.$queryRaw<EventKpiRow[]>`
          SELECT
            COALESCE(SUM("totalTokens"), 0) AS "totalTokens",
            COALESCE(SUM("cachedTokens"), 0) AS "cachedTokens",
            COALESCE(SUM("costUsd"), 0) AS "costUsd",
            COUNT(*) AS "requestCount",
            MAX("eventTime") AS "latestEventTime"
          FROM "UsageEvent"
          WHERE
            (${eventFrom ?? null}::timestamptz IS NULL OR "eventTime" >= ${eventFrom ?? null}::timestamptz)
            AND (${eventTo ?? null}::timestamptz IS NULL OR "eventTime" <= ${eventTo ?? null}::timestamptz)
            ${channelEventFilter}
        `
      : Promise.resolve([] as EventKpiRow[]),
  ]);

  const dailyKpiRow = dailyKpi[0];
  const eventKpiRow = eventKpi[0];

  const kpis: DashboardKpis = {
    costUsd: Number((dailyKpiRow?.costUsd ?? 0)) + Number((eventKpiRow?.costUsd ?? 0)),
    totalTokens: Number(dailyKpiRow?.totalTokens ?? 0) + Number(eventKpiRow?.totalTokens ?? 0),
    cachedTokens: Number(dailyKpiRow?.cachedTokens ?? 0) + Number(eventKpiRow?.cachedTokens ?? 0),
    requestCount: Number(dailyKpiRow?.requestCount ?? 0) + Number(eventKpiRow?.requestCount ?? 0),
    latestEventTime: eventKpiRow?.latestEventTime ? new Date(eventKpiRow.latestEventTime).toISOString() : null,
  };

  const bucketSql = range.granularity === "hour" ? Prisma.sql`DATE_TRUNC('hour', "eventTime")` : Prisma.sql`DATE_TRUNC('day', "eventTime")`;

  type TrendRow = {
    bucket: Date | string;
    totalTokens: bigint;
    cachedTokens: bigint;
    costUsd: any;
    requestCount: bigint;
  };

  const [dailyTrend, eventTrend] = await Promise.all([
    useDaily
      ? prisma.$queryRaw<TrendRow[]>`
          SELECT
            DATE_TRUNC('day', "date") AS bucket,
            COALESCE(SUM("totalTokens"), 0) AS "totalTokens",
            COALESCE(SUM("cachedTokens"), 0) AS "cachedTokens",
            COALESCE(SUM("costUsd"), 0) AS "costUsd",
            COALESCE(SUM("totalRequests"), 0) AS "requestCount"
          FROM "UsageDaily"
          WHERE
            (${dailyFrom ?? null}::timestamptz IS NULL OR "date" >= ${dailyFrom ?? null}::timestamptz)
            AND (${dailyTo ?? null}::timestamptz IS NULL OR "date" <= ${dailyTo ?? null}::timestamptz)
            ${codexDailyFilter}
          GROUP BY bucket
          ORDER BY bucket
        `
      : Promise.resolve([] as TrendRow[]),
    includeEvents
      ? prisma.$queryRaw<TrendRow[]>`
          SELECT
            ${bucketSql} AS bucket,
            COALESCE(SUM("totalTokens"), 0) AS "totalTokens",
            COALESCE(SUM("cachedTokens"), 0) AS "cachedTokens",
            COALESCE(SUM("costUsd"), 0) AS "costUsd",
            COUNT(*) AS "requestCount"
          FROM "UsageEvent"
          WHERE
            (${eventFrom ?? null}::timestamptz IS NULL OR "eventTime" >= ${eventFrom ?? null}::timestamptz)
            AND (${eventTo ?? null}::timestamptz IS NULL OR "eventTime" <= ${eventTo ?? null}::timestamptz)
            ${channelEventFilter}
          GROUP BY bucket
          ORDER BY bucket
        `
      : Promise.resolve([] as TrendRow[]),
  ]);

  const trendMap = new Map<string, { costUsd: number; totalTokens: number; requestCount: number }>();
  for (const row of [...dailyTrend, ...eventTrend]) {
    const key = normalizeBucket(row.bucket);
    const current = trendMap.get(key) ?? { costUsd: 0, totalTokens: 0, requestCount: 0 };
    trendMap.set(key, {
      costUsd: current.costUsd + Number(row.costUsd ?? 0),
      totalTokens: current.totalTokens + Number(row.totalTokens ?? 0),
      requestCount: current.requestCount + Number(row.requestCount ?? 0),
    });
  }

  const timeline = buildBucketTimeline(range);
  const trendBuckets: DashboardTrendBucket[] = timeline.map((bucketDate) => {
    const ts = bucketDate.toISOString();
    const row = trendMap.get(ts);
    return {
      ts,
      costUsd: row?.costUsd ?? 0,
      totalTokens: row?.totalTokens ?? 0,
      requestCount: row?.requestCount ?? 0,
    };
  });

  return { kpis, trendBuckets };
}
