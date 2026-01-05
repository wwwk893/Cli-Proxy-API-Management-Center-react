import { NextRequest, NextResponse } from "next/server";

import { asAuthError } from "@/lib/auth/errors";
import { requireSession } from "@/lib/auth/session";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseSearchParams, usageSessionsQuerySchema } from "@/lib/api";

type FacetRow = { value: string; count: bigint };

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
  const parsed = parseSearchParams(searchParams, usageSessionsQuerySchema);
  if (!parsed.success) return parsed.error;

  const {
    from,
    to,
    channels = ["cliproxy", "codex", "opencode"],
    model: models = [],
    originator = [],
    deviceId = [],
    cwd = [],
    effort = [],
    q,
    limit = 50,
    offset = 0,
    sortBy = "lastActivity",
    sortDir = "desc",
    includeFacets = false,
  } = parsed.data;

  const cliChannels = channels.filter((c) => c === "codex" || c === "opencode");
  if (!cliChannels.length) {
    return NextResponse.json({
      data: [],
      page: { limit, offset, total: 0 },
      facets: includeFacets
        ? { models: [], originators: [], devices: [], cwds: [], efforts: [] }
        : undefined,
    });
  }

  const modelFilter = models.length
    ? Prisma.sql`AND "model" = ANY(${models}::text[])`
    : Prisma.sql``;
  const originatorFilter = originator.length
    ? Prisma.sql`AND "originator" = ANY(${originator}::text[])`
    : Prisma.sql``;
  const deviceFilter = deviceId.length
    ? Prisma.sql`AND "proxyHost" = ANY(${deviceId}::text[])`
    : Prisma.sql``;
  const cwdFilter = cwd.length
    ? Prisma.sql`AND "cwd" = ANY(${cwd}::text[])`
    : Prisma.sql``;
  const effortFilter = effort.length
    ? Prisma.sql`AND "effort" = ANY(${effort}::text[])`
    : Prisma.sql``;
  const qFilter = q
    ? (() => {
        const like = `%${q}%`;
        return Prisma.sql`AND ("sessionId" ILIKE ${like} OR "cwd" ILIKE ${like})`;
      })()
    : Prisma.sql``;

  const baseWhere = Prisma.sql`
    WHERE
      "sourceType" = ANY(${cliChannels}::text[])
      AND "sessionId" IS NOT NULL
      AND (${from ?? null}::timestamptz IS NULL OR "eventTime" >= ${from ?? null}::timestamptz)
      AND (${to ?? null}::timestamptz IS NULL OR "eventTime" <= ${to ?? null}::timestamptz)
      ${modelFilter}
      ${originatorFilter}
      ${deviceFilter}
      ${cwdFilter}
      ${effortFilter}
      ${qFilter}
  `;

  const sortExprMap: Record<
    typeof sortBy,
    Prisma.Sql
  > = {
    lastActivity: Prisma.sql`MAX("eventTime")`,
    costUsd: Prisma.sql`SUM("costUsd")`,
    totalTokens: Prisma.sql`SUM("totalTokens")`,
    durationMs: Prisma.sql`(EXTRACT(EPOCH FROM MAX("eventTime")) - EXTRACT(EPOCH FROM MIN("eventTime")))`,
    turns: Prisma.sql`COUNT(*)`,
  };

  const sortExpr = sortExprMap[sortBy];
  const sortDirSql = sortDir === "asc" ? Prisma.sql`ASC` : Prisma.sql`DESC`;

  try {
    const totalRows = await prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(DISTINCT "sessionId") AS total
      FROM "UsageEvent"
      ${baseWhere}
    `;
    const total = Number(totalRows?.[0]?.total ?? 0);

    const rows = await prisma.$queryRaw<
      {
        sessionId: string;
        firstActivity: Date | string;
        lastActivity: Date | string;
        durationMs: number;
        cwd: string | null;
        originator: string | null;
        cliVersion: string | null;
        effort: string | null;
        deviceId: string | null;
        models: string[];
        turns: bigint;
        inputTokens: bigint;
        cachedTokens: bigint;
        outputTokens: bigint;
        reasoningTokens: bigint;
        totalTokens: bigint;
        costUsd: any;
      }[]
    >`
      SELECT
        "sessionId" AS "sessionId",
        MIN("eventTime") AS "firstActivity",
        MAX("eventTime") AS "lastActivity",
        (EXTRACT(EPOCH FROM MAX("eventTime")) - EXTRACT(EPOCH FROM MIN("eventTime"))) * 1000 AS "durationMs",
        MAX("cwd") AS "cwd",
        MAX("originator") AS "originator",
        MAX("cliVersion") AS "cliVersion",
        MAX("effort") AS "effort",
        MAX("proxyHost") AS "deviceId",
        ARRAY_AGG(DISTINCT "model") AS "models",
        COUNT(*) AS "turns",
        SUM("inputTokens") AS "inputTokens",
        SUM("cachedTokens") AS "cachedTokens",
        SUM("outputTokens") AS "outputTokens",
        SUM("reasoningTokens") AS "reasoningTokens",
        SUM("totalTokens") AS "totalTokens",
        SUM("costUsd") AS "costUsd"
      FROM "UsageEvent"
      ${baseWhere}
      GROUP BY "sessionId"
      ORDER BY ${sortExpr} ${sortDirSql}, MAX("eventTime") DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    let facets: {
      models: { value: string; count: number }[];
      originators: { value: string; count: number }[];
      devices: { value: string; count: number }[];
      cwds: { value: string; count: number }[];
      efforts: { value: string; count: number }[];
    } | undefined;

    if (includeFacets) {
      const [modelFacet, originatorFacet, deviceFacet, cwdFacet, effortFacet] =
        await Promise.all([
          prisma.$queryRaw<FacetRow[]>`
            SELECT "model" AS value, COUNT(DISTINCT "sessionId") AS count
            FROM "UsageEvent"
            ${baseWhere}
            GROUP BY "model"
            ORDER BY count DESC
            LIMIT 50
          `,
          prisma.$queryRaw<FacetRow[]>`
            SELECT "originator" AS value, COUNT(DISTINCT "sessionId") AS count
            FROM "UsageEvent"
            ${baseWhere}
            AND "originator" IS NOT NULL
            GROUP BY "originator"
            ORDER BY count DESC
            LIMIT 50
          `,
          prisma.$queryRaw<FacetRow[]>`
            SELECT "proxyHost" AS value, COUNT(DISTINCT "sessionId") AS count
            FROM "UsageEvent"
            ${baseWhere}
            AND "proxyHost" IS NOT NULL
            GROUP BY "proxyHost"
            ORDER BY count DESC
            LIMIT 50
          `,
          prisma.$queryRaw<FacetRow[]>`
            SELECT "cwd" AS value, COUNT(DISTINCT "sessionId") AS count
            FROM "UsageEvent"
            ${baseWhere}
            AND "cwd" IS NOT NULL
            GROUP BY "cwd"
            ORDER BY count DESC
            LIMIT 50
          `,
          prisma.$queryRaw<FacetRow[]>`
            SELECT "effort" AS value, COUNT(DISTINCT "sessionId") AS count
            FROM "UsageEvent"
            ${baseWhere}
            AND "effort" IS NOT NULL
            GROUP BY "effort"
            ORDER BY count DESC
            LIMIT 50
          `,
        ]);

      const toFacet = (arr: FacetRow[]) =>
        (arr ?? [])
          .filter((r) => typeof r.value === "string" && r.value.length > 0)
          .map((r) => ({ value: r.value, count: Number(r.count ?? 0) }));

      facets = {
        models: toFacet(modelFacet),
        originators: toFacet(originatorFacet),
        devices: toFacet(deviceFacet),
        cwds: toFacet(cwdFacet),
        efforts: toFacet(effortFacet),
      };
    }

    const data = (rows ?? []).map((row: any) => ({
      sessionId: row.sessionId,
      firstActivity: row.firstActivity instanceof Date ? row.firstActivity.toISOString() : row.firstActivity,
      lastActivity: row.lastActivity instanceof Date ? row.lastActivity.toISOString() : row.lastActivity,
      durationMs: Number(row.durationMs ?? 0),
      cwd: row.cwd,
      originator: row.originator,
      cliVersion: row.cliVersion,
      effort: row.effort,
      deviceId: row.deviceId,
      models: (row.models ?? []).filter(Boolean),
      turns: Number(row.turns ?? 0),
      inputTokens: Number(row.inputTokens ?? 0),
      cachedTokens: Number(row.cachedTokens ?? 0),
      outputTokens: Number(row.outputTokens ?? 0),
      reasoningTokens: Number(row.reasoningTokens ?? 0),
      totalTokens: Number(row.totalTokens ?? 0),
      costUsd: Number(row.costUsd ?? 0),
    }));

    return NextResponse.json({
      data,
      page: { limit, offset, total },
      facets,
    });
  } catch (err) {
    console.error("Usage sessions API error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
