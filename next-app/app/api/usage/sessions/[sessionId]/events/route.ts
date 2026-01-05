import { NextRequest, NextResponse } from "next/server";

import { asAuthError } from "@/lib/auth/errors";
import { requireSession } from "@/lib/auth/session";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseSearchParams, usageSessionEventsQuerySchema } from "@/lib/api";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ sessionId: string }> }
) {
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
  const parsed = parseSearchParams(searchParams, usageSessionEventsQuerySchema);
  if (!parsed.success) return parsed.error;

  const { from, to, channels = ["cliproxy", "codex", "opencode"], limit, offset } = parsed.data;
  const { sessionId } = await context.params;

  const cliChannels = channels.filter((c) => c === "codex" || c === "opencode");
  if (!cliChannels.length) {
    return NextResponse.json({ error: "No session data for current channels" }, { status: 404 });
  }

  try {
    const metaRows = await prisma.$queryRaw<
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
      WHERE
        "sourceType" = ANY(${cliChannels}::text[])
        AND "sessionId" = ${sessionId}
        AND (${from ?? null}::timestamptz IS NULL OR "eventTime" >= ${from ?? null}::timestamptz)
        AND (${to ?? null}::timestamptz IS NULL OR "eventTime" <= ${to ?? null}::timestamptz)
      GROUP BY "sessionId"
      LIMIT 1
    `;

    const meta = metaRows?.[0];
    if (!meta) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const pageSql = limit
      ? Prisma.sql`LIMIT ${limit} OFFSET ${offset ?? 0}`
      : Prisma.sql``;

    const events = await prisma.$queryRaw<
      {
        eventTime: Date | string;
        model: string;
        inputTokens: bigint;
        cachedTokens: bigint;
        outputTokens: bigint;
        reasoningTokens: bigint;
        totalTokens: bigint;
        costUsd: any;
        status: string | null;
        rawKey: string;
      }[]
    >`
      SELECT
        "eventTime" AS "eventTime",
        "model" AS "model",
        "inputTokens" AS "inputTokens",
        "cachedTokens" AS "cachedTokens",
        "outputTokens" AS "outputTokens",
        "reasoningTokens" AS "reasoningTokens",
        "totalTokens" AS "totalTokens",
        "costUsd" AS "costUsd",
        "status" AS "status",
        "rawKey" AS "rawKey"
      FROM "UsageEvent"
      WHERE
        "sourceType" = ANY(${cliChannels}::text[])
        AND "sessionId" = ${sessionId}
        AND (${from ?? null}::timestamptz IS NULL OR "eventTime" >= ${from ?? null}::timestamptz)
        AND (${to ?? null}::timestamptz IS NULL OR "eventTime" <= ${to ?? null}::timestamptz)
      ORDER BY "eventTime" ASC
      ${pageSql}
    `;

    return NextResponse.json({
      sessionId: meta.sessionId,
      meta: {
        cwd: meta.cwd,
        originator: meta.originator,
        cliVersion: meta.cliVersion,
        effort: meta.effort,
        deviceId: meta.deviceId,
      },
      totals: {
        firstActivity: meta.firstActivity instanceof Date ? meta.firstActivity.toISOString() : meta.firstActivity,
        lastActivity: meta.lastActivity instanceof Date ? meta.lastActivity.toISOString() : meta.lastActivity,
        durationMs: Number(meta.durationMs ?? 0),
        models: (meta.models ?? []).filter(Boolean),
        turns: Number(meta.turns ?? 0),
        inputTokens: Number(meta.inputTokens ?? 0),
        cachedTokens: Number(meta.cachedTokens ?? 0),
        outputTokens: Number(meta.outputTokens ?? 0),
        reasoningTokens: Number(meta.reasoningTokens ?? 0),
        totalTokens: Number(meta.totalTokens ?? 0),
        costUsd: Number(meta.costUsd ?? 0),
      },
      events: (events ?? []).map((e: any) => ({
        eventTime: e.eventTime instanceof Date ? e.eventTime.toISOString() : e.eventTime,
        model: e.model,
        inputTokens: Number(e.inputTokens ?? 0),
        cachedTokens: Number(e.cachedTokens ?? 0),
        outputTokens: Number(e.outputTokens ?? 0),
        reasoningTokens: Number(e.reasoningTokens ?? 0),
        totalTokens: Number(e.totalTokens ?? 0),
        costUsd: Number(e.costUsd ?? 0),
        status: e.status,
        rawKey: e.rawKey,
      })),
    });
  } catch (err) {
    console.error("Usage session events API error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
