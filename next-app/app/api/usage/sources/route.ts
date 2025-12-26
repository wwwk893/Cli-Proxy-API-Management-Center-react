import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseSearchParams, usageByModelQuerySchema } from "@/lib/api";

const startOfUtcDay = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = parseSearchParams(searchParams, usageByModelQuerySchema);
  if (!parsed.success) return parsed.error;

  const { from, to, apiPath, channels = ["cliproxy", "codex"], sources = [] } = parsed.data;

  const codexApiPaths = ["codex-cli", "codex"];
  const includeCodex = channels.includes("codex");
  const includeCliproxy = channels.includes("cliproxy");

  const codexDailyFilter =
    includeCodex && !includeCliproxy
      ? Prisma.sql`AND "apiPath" = ANY(${codexApiPaths}::text[])`
      : !includeCodex && includeCliproxy
        ? Prisma.sql`AND NOT ("apiPath" = ANY(${codexApiPaths}::text[]))`
        : Prisma.sql``;

  const channelEventFilter =
    includeCodex !== includeCliproxy ? Prisma.sql`AND "sourceType" = ANY(${channels}::text[])` : Prisma.sql``;

  const sourceFilter = sources.length
    ? Prisma.sql`AND "authSource" = ANY(${sources}::text[])`
    : Prisma.sql``;

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

    type SourceAggRow = {
      authSource: string | null;
      cachedTokens: bigint;
      totalTokens: bigint;
      costUsd: any;
      requestCount: bigint;
    };

    const dailyRowsPromise: Promise<SourceAggRow[]> = useDaily
      ? prisma.$queryRaw<SourceAggRow[]>`
            SELECT
              "authSource" AS "authSource",
              SUM("cachedTokens") AS "cachedTokens",
              SUM("totalTokens") AS "totalTokens",
              SUM("costUsd") AS "costUsd",
              SUM("totalRequests") AS "requestCount"
            FROM "UsageDaily"
            WHERE
              (${dailyFrom ?? null}::timestamptz IS NULL OR "date" >= ${dailyFrom ?? null}::timestamptz)
              AND (${dailyTo ?? null}::timestamptz IS NULL OR "date" <= ${dailyTo ?? null}::timestamptz)
              AND (${apiPath ?? null}::text IS NULL OR "apiPath" = ${apiPath ?? null})
              ${codexDailyFilter}
              ${sourceFilter}
            GROUP BY "authSource"
            ORDER BY "authSource"
          `
      : Promise.resolve([] as SourceAggRow[]);

    const eventRowsPromise: Promise<SourceAggRow[]> = includeEvents
      ? prisma.$queryRaw<SourceAggRow[]>`
            SELECT
              "authSource" AS "authSource",
              SUM("cachedTokens") AS "cachedTokens",
              SUM("totalTokens") AS "totalTokens",
              SUM("costUsd") AS "costUsd",
              COUNT(*) AS "requestCount"
            FROM "UsageEvent"
            WHERE
              (${eventFrom ?? null}::timestamptz IS NULL OR "eventTime" >= ${eventFrom ?? null}::timestamptz)
              AND (${eventTo ?? null}::timestamptz IS NULL OR "eventTime" <= ${eventTo ?? null}::timestamptz)
              AND (${apiPath ?? null}::text IS NULL OR "apiPath" = ${apiPath ?? null})
              ${channelEventFilter}
              ${sourceFilter}
            GROUP BY "authSource"
            ORDER BY "authSource"
          `
      : Promise.resolve([] as SourceAggRow[]);

    const [dailyRows, eventRows] = await Promise.all([dailyRowsPromise, eventRowsPromise]);

    const map: Record<string, { source: string | null; totalTokens: number; cachedTokens: number; costUsd: number; requestCount: number }> = {};

    [...dailyRows, ...eventRows].forEach((row) => {
      const key = row.authSource ?? "";
      const cachedTokens = Number(row.cachedTokens ?? 0);
      const totalTokens = Number(row.totalTokens ?? 0);
      const costUsd = Number(row.costUsd ?? 0);

      if (!map[key]) {
        map[key] = {
          source: row.authSource,
          totalTokens: 0,
          cachedTokens: 0,
          costUsd: 0,
          requestCount: 0,
        };
      }

      map[key].totalTokens += totalTokens;
      map[key].cachedTokens += cachedTokens;
      map[key].costUsd += costUsd;
      map[key].requestCount += Number(row.requestCount ?? 0);
    });

    const data = Object.values(map).sort((a, b) => (b.totalTokens ?? 0) - (a.totalTokens ?? 0));

    return NextResponse.json({ data });
  } catch (err) {
    console.error("Usage sources API error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
