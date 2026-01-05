import { NextRequest, NextResponse } from "next/server";

import { asAuthError } from "@/lib/auth/errors";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { parseSearchParams, usageQuerySchema, type Dimension, type Granularity } from "@/lib/api";
import { CLI_API_PATHS, CODEX_API_PATHS, OPENCODE_API_PATHS } from "@/lib/usage/aggregation-constants";

const startOfUtcDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
const bucketToNumber = (value: Date | string) => (value instanceof Date ? value.getTime() : new Date(value).getTime());

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

  const parsed = parseSearchParams(searchParams, usageQuerySchema);
  if (!parsed.success) {
    return parsed.error;
  }

  const {
    from,
    to,
    model: models = [],
    apiPath,
    granularity = "day",
    view,
    channels = ["cliproxy", "codex", "opencode"],
    sources = [],
    groupBySource = false,
    dimension,
  } = parsed.data;

  const codexApiPaths = [...CODEX_API_PATHS];
  const opencodeApiPaths = [...OPENCODE_API_PATHS];
  const cliApiPaths = [...CLI_API_PATHS];
  const includeCodex = channels.includes("codex");
  const includeOpencode = channels.includes("opencode");
  const includeCliproxy = channels.includes("cliproxy");

  const fromDate = from ? new Date(from) : undefined;
  const toDate = to ? new Date(to) : undefined;
  const todayStart = startOfUtcDay(new Date());
  const endOfYesterday = new Date(todayStart.getTime() - 1);

  const useDaily = granularity === "day" && (fromDate ? fromDate < todayStart : true);
  const dailyFrom = useDaily ? fromDate : undefined;
  const dailyTo = useDaily ? (toDate && toDate < todayStart ? toDate : endOfYesterday) : undefined;
  const includeEvents = !useDaily || (toDate ? toDate >= todayStart : true);
  const eventFrom = includeEvents
    ? granularity === "day" && useDaily
      ? fromDate && fromDate > todayStart
        ? fromDate
        : todayStart
      : fromDate
    : undefined;
  const eventTo = includeEvents ? toDate : undefined;

  const effectiveDimension: Dimension = dimension
    ? dimension
    : view === "aggregate"
      ? "overall"
      : view === "source"
        ? "source"
        : view === "source-model"
          ? "model+source"
          : view === "channel"
            ? "channel"
            : view === "channel-model"
              ? "model+channel"
              : "model";
  const finalDimension: Dimension = !dimension && groupBySource && effectiveDimension === "model" ? "source" : effectiveDimension;

  const bucketSqlMap: Record<Granularity, Prisma.Sql> = {
    day: Prisma.sql`DATE_TRUNC('day', "eventTime")`,
    hour: Prisma.sql`DATE_TRUNC('hour', "eventTime")`,
    minute: Prisma.sql`DATE_TRUNC('minute', "eventTime")`,
    second: Prisma.sql`DATE_TRUNC('second', "eventTime")`,
  };

  const bucket = bucketSqlMap[granularity as Granularity];
  const modelFilter = models.length
    ? Prisma.sql`AND "model" = ANY(${models}::text[])`
    : Prisma.sql``;
  const sourceFilter = sources.length
    ? Prisma.sql`AND "authSource" = ANY(${sources}::text[])`
    : Prisma.sql``;

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
    channels.length < 3
      ? Prisma.sql`AND "sourceType" = ANY(${channels}::text[])`
      : Prisma.sql``;

  try {
    if (finalDimension === "model") {
	          const dailyRows = useDaily
	        ? await prisma.$queryRaw<
	            {
	              bucket: Date | string;
	              model: string;
	              inputTokens: bigint;
	              outputTokens: bigint;
	              reasoningTokens: bigint;
	              cachedTokens: bigint;
	              totalTokens: bigint;
	              costUsd: any;
	              requestCount: bigint;
	            }[]
	          >`
	            SELECT
	              DATE_TRUNC('day', "date") AS bucket,
	              "model" AS "model",
	              SUM("inputTokens") AS "inputTokens",
	              SUM("outputTokens") AS "outputTokens",
	              SUM("reasoningTokens") AS "reasoningTokens",
	              SUM("cachedTokens") AS "cachedTokens",
	              SUM("totalTokens") AS "totalTokens",
	              SUM("costUsd") AS "costUsd",
	              SUM("totalRequests") AS "requestCount"
	            FROM "UsageDaily"
	            WHERE
	              (${dailyFrom ?? null}::timestamptz IS NULL OR "date" >= ${dailyFrom ?? null}::timestamptz)
	              AND (${dailyTo ?? null}::timestamptz IS NULL OR "date" <= ${dailyTo ?? null}::timestamptz)
	              ${modelFilter}
	              ${sourceFilter}
	              ${dailyChannelFilter}
	              AND (${apiPath ?? null}::text IS NULL OR "apiPath" = ${apiPath ?? null})
	            GROUP BY bucket, "model"
	            ORDER BY bucket, "model"
	          `
	        : [];

	      const eventRows = includeEvents
	        ? await prisma.$queryRaw<
	            {
	              bucket: Date | string;
	              model: string;
	              inputTokens: bigint;
	              outputTokens: bigint;
	              reasoningTokens: bigint;
	              cachedTokens: bigint;
	              totalTokens: bigint;
	              costUsd: any;
	              requestCount: bigint;
	            }[]
	          >`
	            SELECT
	              ${bucket} AS bucket,
	              "model" AS "model",
	              SUM("inputTokens") AS "inputTokens",
	              SUM("outputTokens") AS "outputTokens",
	              SUM("reasoningTokens") AS "reasoningTokens",
	              SUM("cachedTokens") AS "cachedTokens",
	              SUM("totalTokens") AS "totalTokens",
	              SUM("costUsd") AS "costUsd",
	              COUNT(*) AS "requestCount"
	            FROM "UsageEvent"
	            WHERE
	              (${eventFrom ?? null}::timestamptz IS NULL OR "eventTime" >= ${eventFrom ?? null}::timestamptz)
	              AND (${eventTo ?? null}::timestamptz IS NULL OR "eventTime" <= ${eventTo ?? null}::timestamptz)
	              ${modelFilter}
	              ${sourceFilter}
	              ${channelEventFilter}
	              AND (${apiPath ?? null}::text IS NULL OR "apiPath" = ${apiPath ?? null})
	            GROUP BY bucket, "model"
	            ORDER BY bucket, "model"
	          `
	        : [];

      const rows = [...dailyRows, ...eventRows].sort((a, b) => {
        const diff = bucketToNumber(a.bucket) - bucketToNumber(b.bucket);
        if (diff !== 0) return diff;
        return a.model.localeCompare(b.model);
      });

	      const data = rows.map((row) => {
	        const bucketValue = row.bucket instanceof Date ? row.bucket.toISOString() : row.bucket;
	        const inputTokens = Number(row.inputTokens ?? 0);
	        const outputTokens = Number(row.outputTokens ?? 0);
	        const reasoningTokens = Number(row.reasoningTokens ?? 0);
	        const cachedTokens = Number(row.cachedTokens ?? 0);
	        const totalTokens = Number(row.totalTokens ?? 0);
	        const costUsd = Number(row.costUsd ?? 0);

	        return {
	          bucket: bucketValue,
	          date: bucketValue,
	          model: row.model,
          totalTokens,
          cachedTokens,
          costUsd,
          requestCount: Number(row.requestCount ?? 0),
        };
      });

      return NextResponse.json({ data, view: "per-model" as const, dimension: finalDimension });
    }

    // Channel view (sourceType)
    if (finalDimension === "channel" || finalDimension === "model+channel") {
      const dailyRows = useDaily
        ? await prisma.$queryRaw<
            {
              bucket: Date | string;
              model: string | null;
              channel: string;
              inputTokens: bigint;
              outputTokens: bigint;
              reasoningTokens: bigint;
              cachedTokens: bigint;
              totalTokens: bigint;
              costUsd: any;
              requestCount: bigint;
            }[]
          >`
            SELECT
              DATE_TRUNC('day', "date") AS bucket,
              ${finalDimension === "model+channel" ? Prisma.sql`"model"` : Prisma.sql`NULL`} AS "model",
              CASE
                WHEN "apiPath" = ANY(${codexApiPaths}::text[]) THEN 'codex'
                WHEN "apiPath" = ANY(${opencodeApiPaths}::text[]) THEN 'opencode'
                ELSE 'cliproxy'
              END AS "channel",
              SUM("inputTokens") AS "inputTokens",
              SUM("outputTokens") AS "outputTokens",
              SUM("reasoningTokens") AS "reasoningTokens",
              SUM("cachedTokens") AS "cachedTokens",
              SUM("totalTokens") AS "totalTokens",
              SUM("costUsd") AS "costUsd",
              SUM("totalRequests") AS "requestCount"
            FROM "UsageDaily"
            WHERE
              (${dailyFrom ?? null}::timestamptz IS NULL OR "date" >= ${dailyFrom ?? null}::timestamptz)
              AND (${dailyTo ?? null}::timestamptz IS NULL OR "date" <= ${dailyTo ?? null}::timestamptz)
              ${modelFilter}
              ${sourceFilter}
              ${dailyChannelFilter}
              AND (${apiPath ?? null}::text IS NULL OR "apiPath" = ${apiPath ?? null})
            GROUP BY bucket, "model", "channel"
            ORDER BY bucket, "model", "channel"
          `
        : [];

      const eventRows = includeEvents
        ? await prisma.$queryRaw<
            {
              bucket: Date | string;
              model: string | null;
              channel: string;
              inputTokens: bigint;
              outputTokens: bigint;
              reasoningTokens: bigint;
              cachedTokens: bigint;
              totalTokens: bigint;
              costUsd: any;
              requestCount: bigint;
            }[]
          >`
            SELECT
              ${bucket} AS bucket,
              ${finalDimension === "model+channel" ? Prisma.sql`"model"` : Prisma.sql`NULL`} AS "model",
              COALESCE("sourceType", 'cliproxy') AS "channel",
              SUM("inputTokens") AS "inputTokens",
              SUM("outputTokens") AS "outputTokens",
              SUM("reasoningTokens") AS "reasoningTokens",
              SUM("cachedTokens") AS "cachedTokens",
              SUM("totalTokens") AS "totalTokens",
              SUM("costUsd") AS "costUsd",
              COUNT(*) AS "requestCount"
            FROM "UsageEvent"
            WHERE
              (${eventFrom ?? null}::timestamptz IS NULL OR "eventTime" >= ${eventFrom ?? null}::timestamptz)
              AND (${eventTo ?? null}::timestamptz IS NULL OR "eventTime" <= ${eventTo ?? null}::timestamptz)
              ${modelFilter}
              ${sourceFilter}
              ${channelEventFilter}
              AND (${apiPath ?? null}::text IS NULL OR "apiPath" = ${apiPath ?? null})
            GROUP BY bucket, "model", "channel"
            ORDER BY bucket, "model", "channel"
          `
        : [];

      const rows = [...dailyRows, ...eventRows].sort((a, b) => {
        const diff = bucketToNumber(a.bucket) - bucketToNumber(b.bucket);
        if (diff !== 0) return diff;
        const aModel = a.model ?? "";
        const bModel = b.model ?? "";
        const modelCompare = aModel.localeCompare(bModel);
        if (modelCompare !== 0) return modelCompare;
        return a.channel.localeCompare(b.channel);
      });

      if (finalDimension === "model+channel") {
        const data = rows.map((row) => {
          const bucketValue = row.bucket instanceof Date ? row.bucket.toISOString() : row.bucket;
          return {
            bucket: bucketValue,
            date: bucketValue,
            model: row.model ?? "unknown",
            channel: row.channel,
            totalTokens: Number(row.totalTokens ?? 0),
            cachedTokens: Number(row.cachedTokens ?? 0),
            costUsd: Number(row.costUsd ?? 0),
            requestCount: Number(row.requestCount ?? 0),
          };
        });

        return NextResponse.json({ data, view, dimension: finalDimension });
      }

      const data = rows.map((row) => {
        const bucketValue = row.bucket instanceof Date ? row.bucket.toISOString() : row.bucket;
        return {
          bucket: bucketValue,
          date: bucketValue,
          channel: row.channel,
          totalTokens: Number(row.totalTokens ?? 0),
          cachedTokens: Number(row.cachedTokens ?? 0),
          costUsd: Number(row.costUsd ?? 0),
          requestCount: Number(row.requestCount ?? 0),
        };
      });

      return NextResponse.json({ data, view, dimension: finalDimension });
    }

    // Aggregate view
    if (finalDimension === "source" || finalDimension === "model+source") {
      const dailyRows = useDaily
        ? await prisma.$queryRaw<
            {
	              bucket: Date | string;
	              model: string;
	              authSource: string | null;
	              inputTokens: bigint;
	              outputTokens: bigint;
	              reasoningTokens: bigint;
	              cachedTokens: bigint;
	              totalTokens: bigint;
	              costUsd: any;
	              requestCount: bigint;
	            }[]
	          >`
	            SELECT
	              DATE_TRUNC('day', "date") AS bucket,
	              "model" AS "model",
	              "authSource" AS "authSource",
	              SUM("inputTokens") AS "inputTokens",
	              SUM("outputTokens") AS "outputTokens",
	              SUM("reasoningTokens") AS "reasoningTokens",
	              SUM("cachedTokens") AS "cachedTokens",
	              SUM("totalTokens") AS "totalTokens",
	              SUM("costUsd") AS "costUsd",
	              SUM("totalRequests") AS "requestCount"
	            FROM "UsageDaily"
	            WHERE
	              (${dailyFrom ?? null}::timestamptz IS NULL OR "date" >= ${dailyFrom ?? null}::timestamptz)
	              AND (${dailyTo ?? null}::timestamptz IS NULL OR "date" <= ${dailyTo ?? null}::timestamptz)
	              ${modelFilter}
	              ${sourceFilter}
	              ${dailyChannelFilter}
	              AND (${apiPath ?? null}::text IS NULL OR "apiPath" = ${apiPath ?? null})
	            GROUP BY bucket, "model", "authSource"
	            ORDER BY bucket, "model", "authSource"
	          `
	        : [];

	      const eventRows = includeEvents
	        ? await prisma.$queryRaw<
	            {
	              bucket: Date | string;
	              model: string;
	              authSource: string | null;
	              inputTokens: bigint;
	              outputTokens: bigint;
	              reasoningTokens: bigint;
	              cachedTokens: bigint;
	              totalTokens: bigint;
	              costUsd: any;
	              requestCount: bigint;
	            }[]
	          >`
	            SELECT
	              ${bucket} AS bucket,
	              "model" AS "model",
	              "authSource" AS "authSource",
	              SUM("inputTokens") AS "inputTokens",
	              SUM("outputTokens") AS "outputTokens",
	              SUM("reasoningTokens") AS "reasoningTokens",
	              SUM("cachedTokens") AS "cachedTokens",
	              SUM("totalTokens") AS "totalTokens",
	              SUM("costUsd") AS "costUsd",
	              COUNT(*) AS "requestCount"
	            FROM "UsageEvent"
	            WHERE
	              (${eventFrom ?? null}::timestamptz IS NULL OR "eventTime" >= ${eventFrom ?? null}::timestamptz)
	              AND (${eventTo ?? null}::timestamptz IS NULL OR "eventTime" <= ${eventTo ?? null}::timestamptz)
	              ${modelFilter}
	              ${sourceFilter}
	              ${channelEventFilter}
	              AND (${apiPath ?? null}::text IS NULL OR "apiPath" = ${apiPath ?? null})
	            GROUP BY bucket, "model", "authSource"
	            ORDER BY bucket, "model", "authSource"
	          `
	        : [];

      const rows = [...dailyRows, ...eventRows].sort((a, b) => {
        const diff = bucketToNumber(a.bucket) - bucketToNumber(b.bucket);
        if (diff !== 0) return diff;
        const modelCompare = a.model.localeCompare(b.model);
        if (modelCompare !== 0) return modelCompare;
        const aSource = a.authSource ?? "";
        const bSource = b.authSource ?? "";
        return aSource.localeCompare(bSource);
      });

	      if (finalDimension === "model+source") {
	        const data = rows.map((row) => {
	          const bucketValue = row.bucket instanceof Date ? row.bucket.toISOString() : row.bucket;
	          const inputTokens = Number(row.inputTokens ?? 0);
	          const outputTokens = Number(row.outputTokens ?? 0);
	          const reasoningTokens = Number(row.reasoningTokens ?? 0);
	          const cachedTokens = Number(row.cachedTokens ?? 0);
	          const totalTokens = Number(row.totalTokens ?? 0);
	          const costUsd = Number(row.costUsd ?? 0);
	          return {
	            bucket: bucketValue,
	            date: bucketValue,
	            model: row.model,
            authSource: row.authSource,
            totalTokens,
            cachedTokens,
            costUsd,
            requestCount: Number(row.requestCount ?? 0),
          };
        });

        return NextResponse.json({ data, view: "per-model" as const, dimension: finalDimension });
      }

      const bucketSourceMap: Record<string, { bucket: string; date: string; authSource: string | null; totalTokens: number; cachedTokens: number; costUsd: number; requestCount: number }> = {};

	      rows.forEach((row) => {
	        const bucketValue = row.bucket instanceof Date ? row.bucket.toISOString() : row.bucket;
	        const key = `${bucketValue}::${row.authSource ?? ""}`;
	        const inputTokens = Number(row.inputTokens ?? 0);
	        const outputTokens = Number(row.outputTokens ?? 0);
	        const reasoningTokens = Number(row.reasoningTokens ?? 0);
	        const cachedTokens = Number(row.cachedTokens ?? 0);
	        const totalTokens = Number(row.totalTokens ?? 0);
	        const costUsd = Number(row.costUsd ?? 0);

        if (!bucketSourceMap[key]) {
          bucketSourceMap[key] = {
            bucket: bucketValue,
            date: bucketValue,
            authSource: row.authSource,
            totalTokens: 0,
            cachedTokens: 0,
            costUsd: 0,
            requestCount: 0,
          };
        }
        bucketSourceMap[key].totalTokens += totalTokens;
        bucketSourceMap[key].cachedTokens += cachedTokens;
        bucketSourceMap[key].costUsd += costUsd;
        bucketSourceMap[key].requestCount += Number(row.requestCount ?? 0);
      });

      const data = Object.values(bucketSourceMap).sort((a, b) => (a.bucket > b.bucket ? 1 : -1));

      return NextResponse.json({ data, view: "aggregate" as const, dimension: finalDimension });
    }

    // Aggregate view (overall)
	    const dailyRows = useDaily
	      ? await prisma.$queryRaw<
	          {
	            bucket: Date | string;
	            model: string;
	            inputTokens: bigint;
	            outputTokens: bigint;
	            reasoningTokens: bigint;
	            cachedTokens: bigint;
	            totalTokens: bigint;
	            costUsd: any;
	            requestCount: bigint;
	          }[]
	        >`
	          SELECT
	            DATE_TRUNC('day', "date") AS bucket,
	            "model" AS "model",
	            SUM("inputTokens") AS "inputTokens",
	            SUM("outputTokens") AS "outputTokens",
	            SUM("reasoningTokens") AS "reasoningTokens",
	            SUM("cachedTokens") AS "cachedTokens",
	            SUM("totalTokens") AS "totalTokens",
	            SUM("costUsd") AS "costUsd",
	            SUM("totalRequests") AS "requestCount"
	          FROM "UsageDaily"
	          WHERE
	            (${dailyFrom ?? null}::timestamptz IS NULL OR "date" >= ${dailyFrom ?? null}::timestamptz)
	            AND (${dailyTo ?? null}::timestamptz IS NULL OR "date" <= ${dailyTo ?? null}::timestamptz)
	            ${modelFilter}
	            ${sourceFilter}
	            ${dailyChannelFilter}
	            AND (${apiPath ?? null}::text IS NULL OR "apiPath" = ${apiPath ?? null})
	          GROUP BY bucket, "model"
	          ORDER BY bucket, "model"
	        `
	      : [];

	    const eventRows = includeEvents
	      ? await prisma.$queryRaw<
	          {
	            bucket: Date | string;
	            model: string;
	            inputTokens: bigint;
	            outputTokens: bigint;
	            reasoningTokens: bigint;
	            cachedTokens: bigint;
	            totalTokens: bigint;
	            costUsd: any;
	            requestCount: bigint;
	          }[]
	        >`
	          SELECT
	            ${bucket} AS bucket,
	            "model" AS "model",
	            SUM("inputTokens") AS "inputTokens",
	            SUM("outputTokens") AS "outputTokens",
	            SUM("reasoningTokens") AS "reasoningTokens",
	            SUM("cachedTokens") AS "cachedTokens",
	            SUM("totalTokens") AS "totalTokens",
	            SUM("costUsd") AS "costUsd",
	            COUNT(*) AS "requestCount"
	          FROM "UsageEvent"
	          WHERE
	            (${eventFrom ?? null}::timestamptz IS NULL OR "eventTime" >= ${eventFrom ?? null}::timestamptz)
	            AND (${eventTo ?? null}::timestamptz IS NULL OR "eventTime" <= ${eventTo ?? null}::timestamptz)
	            ${modelFilter}
	            ${sourceFilter}
	            ${channelEventFilter}
	            AND (${apiPath ?? null}::text IS NULL OR "apiPath" = ${apiPath ?? null})
	          GROUP BY bucket, "model"
	          ORDER BY bucket, "model"
	        `
	      : [];

    const rows = [...dailyRows, ...eventRows].sort((a, b) => {
      const diff = bucketToNumber(a.bucket) - bucketToNumber(b.bucket);
      if (diff !== 0) return diff;
      return a.model.localeCompare(b.model);
    });

    const bucketMap: Record<string, { bucket: string; date: string; totalTokens: number; cachedTokens: number; costUsd: number; requestCount: number }> = {};

	    rows.forEach((row) => {
	      const bucketValue = row.bucket instanceof Date ? row.bucket.toISOString() : row.bucket;
	      const key = bucketValue;
	      const inputTokens = Number(row.inputTokens ?? 0);
	      const outputTokens = Number(row.outputTokens ?? 0);
	      const reasoningTokens = Number(row.reasoningTokens ?? 0);
	      const cachedTokens = Number(row.cachedTokens ?? 0);
	      const totalTokens = Number(row.totalTokens ?? 0);
	      const costUsd = Number(row.costUsd ?? 0);

      if (!bucketMap[key]) {
        bucketMap[key] = {
          bucket: bucketValue,
          date: bucketValue,
          totalTokens: 0,
          cachedTokens: 0,
          costUsd: 0,
          requestCount: 0,
        };
      }
      bucketMap[key].totalTokens += totalTokens;
      bucketMap[key].cachedTokens += cachedTokens;
      bucketMap[key].costUsd += costUsd;
      bucketMap[key].requestCount += Number(row.requestCount ?? 0);
    });

    const data = Object.values(bucketMap).sort((a, b) => (a.bucket > b.bucket ? 1 : -1));

    return NextResponse.json({ data, view: "aggregate" as const, dimension: finalDimension });
  } catch (err) {
    console.error("Usage API error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
