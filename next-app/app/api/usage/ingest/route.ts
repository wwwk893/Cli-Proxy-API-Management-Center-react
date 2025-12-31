import { NextResponse } from "next/server";

import { asAuthError } from "@/lib/auth/errors";
import { assertSameOrigin } from "@/lib/auth/guards";
import { requireSession } from "@/lib/auth/session";
import { parseSearchParams, usageIngestQuerySchema } from "@/lib/api";
import { prisma } from "@/lib/db";
import { serverEnv } from "@/lib/env";
import { fetchManagementJsonWithConfig, toManagementError } from "@/lib/management/client";
import { calcCostUsd, DEFAULT_PRICING, type PricingMap } from "@/lib/pricing";

type TokenDetails = {
  input_tokens?: number;
  output_tokens?: number;
  reasoning_tokens?: number;
  cached_tokens?: number;
  total_tokens?: number;
};

type UsageDetail = {
  timestamp: string;
  status?: string;
  source?: string;
  auth_index?: number | string;
  failed?: boolean;
  tokens?: TokenDetails;
};

type UsageModelStats = {
  total_requests?: number;
  total_tokens?: number;
  details?: UsageDetail[];
};

type UsageApiStats = {
  total_requests?: number;
  total_tokens?: number;
  models?: Record<string, UsageModelStats>;
};

type CliproxyUsagePayload = {
  usage?: {
    total_requests?: number;
    success_count?: number;
    failure_count?: number;
    requests_by_day?: unknown;
    requests_by_hour?: unknown;
    tokens_by_day?: unknown;
    tokens_by_hour?: unknown;
    apis?: Record<string, UsageApiStats>;
  };
  cursor?: string;
  window_start?: string;
  window_end?: string;
};

type UsageEventInput = {
  rawKey: string;
  eventTime: Date;
  apiPath: string;
  model: string;
  proxyHost: string;
  status?: string | null;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  totalTokens: number;
  costUsd: number;
  authSource?: string | null;
  authIndex?: number | null;
  authFailed?: boolean;
  sourceType?: string | null;
};

type IngestResult = {
  inserted: number;
  skipped: number;
  processed: number;
  cursorAfter?: Date | null;
};

function parseDateSafe(ts: string | undefined): Date | null {
  if (!ts) return null;
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function getCursor() {
  const row = await prisma.usageIngestCursor.findUnique({ where: { id: "cliproxy" } });
  return (row as any)?.lastEventAt ?? null;
}

async function ingestUsagePayload(params: {
  payload: CliproxyUsagePayload;
  proxyHost: string;
  backfillSince?: Date;
  maxEvents: number;
  dryRun: boolean;
}): Promise<IngestResult> {
  const { payload, proxyHost, backfillSince, maxEvents, dryRun } = params;

  const cursor = backfillSince ?? (await getCursor());

  const pricingRows = await prisma.modelPricing.findMany();
  const pricingMap: PricingMap = { ...DEFAULT_PRICING };
  pricingRows.forEach((row: any) => {
    pricingMap[row.modelId] = {
      inputPerMillion: Number(row.inputCost ?? 0),
      outputPerMillion: Number(row.outputCost ?? 0),
      cachedPerMillion: Number(row.cachedCost ?? 0),
    };
  });

  const usage = payload?.usage;
  if (!usage || !usage.apis) {
    return { inserted: 0, skipped: 0, processed: 0, cursorAfter: cursor };
  }

  const events: UsageEventInput[] = [];

  for (const [apiPath, apiStats] of Object.entries(usage.apis ?? {})) {
    const models = apiStats.models ?? {};
    for (const [model, modelStats] of Object.entries(models)) {
      const details = modelStats.details ?? [];
      for (const d of details) {
        if (events.length >= maxEvents) break;

        const eventDate = parseDateSafe(d.timestamp);
        if (!eventDate) {
          continue;
        }
        if (cursor && eventDate <= cursor) {
          continue;
        }

        const authIndexRaw = d.auth_index;
        const authIndexNum =
          typeof authIndexRaw === "number"
            ? authIndexRaw
            : typeof authIndexRaw === "string" && authIndexRaw.trim() !== ""
              ? Number(authIndexRaw)
              : null;
        const authIndex = Number.isFinite(authIndexNum) ? Number(authIndexNum) : null;

        const t = d.tokens ?? {};
        const inputTokens = t.input_tokens ?? 0;
        const outputTokens = t.output_tokens ?? 0;
        const reasoningTokens = t.reasoning_tokens ?? 0;
        const cachedTokens = t.cached_tokens ?? 0;
        const totalTokens = t.total_tokens ?? 0;

        const costUsd = calcCostUsd({
          model,
          inputTokens,
          outputTokens,
          reasoningTokens,
          cachedTokens,
          pricingMap,
        });

        const rawKey = `${proxyHost}-${apiPath}-${model}-${d.timestamp}`;

        events.push({
          rawKey,
          eventTime: eventDate,
          apiPath,
          model,
          proxyHost,
          status: d.status ?? null,
          inputTokens,
          outputTokens,
          reasoningTokens,
          cachedTokens,
          totalTokens,
          costUsd,
          authSource: d.source ?? null,
          authIndex,
          authFailed: d.failed ?? false,
          sourceType: "cliproxy",
        });
      }
    }
  }

  let inserted = 0;
  let skipped = 0;

  if (!dryRun) {
    const result = await prisma.$transaction(async (tx: any) => {
      let latest: Date | null = cursor ?? null;

      if (events.length > 0) {
        const res = await tx.usageEvent.createMany({ data: events, skipDuplicates: true });
        inserted = res.count;
        skipped = events.length - res.count;
        latest = events.reduce(
          (max, e) => (max && max > e.eventTime ? max : e.eventTime),
          latest ?? events[0].eventTime,
        );
      }

      const cursorCandidate = latest ?? parseDateSafe(payload.window_end ?? "") ?? cursor;
      if (cursorCandidate) {
        await tx.usageIngestCursor.upsert({
          where: { id: "cliproxy" },
          update: { lastEventAt: cursorCandidate },
          create: { id: "cliproxy", lastEventAt: cursorCandidate },
        });
      }

      return { latest: cursorCandidate };
    });

    return { inserted, skipped, processed: events.length, cursorAfter: result.latest };
  }

  return { inserted, skipped, processed: events.length, cursorAfter: cursor };
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const session = await requireSession();
    const config = { serverBase: session.serverBase, key: session.adminKey };

    const { searchParams } = new URL(req.url);
    const parsed = parseSearchParams(searchParams, usageIngestQuerySchema);
    if (!parsed.success) {
      return parsed.error;
    }

    const { since, max, dryRun } = parsed.data;

    const proxyHost = new URL(session.serverBase).host;
    const backfillSince = since ? new Date(since) : serverEnv.USAGE_INGEST_BACKFILL_SINCE;
    const maxEvents = max ?? serverEnv.USAGE_INGEST_MAX_EVENTS_PER_RUN;
    const dryRunFlag = dryRun ?? serverEnv.USAGE_INGEST_DRY_RUN;

    const { data: payload } = await fetchManagementJsonWithConfig<CliproxyUsagePayload>(config, "/usage", {
      method: "GET",
    });

    const result = await ingestUsagePayload({
      payload,
      proxyHost,
      backfillSince: backfillSince ?? undefined,
      maxEvents,
      dryRun: dryRunFlag,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const authError = asAuthError(err);
    if (authError) {
      return NextResponse.json({ ok: false, error: authError.message }, { status: authError.status });
    }

    const managementError = toManagementError(err);
    const status = managementError.httpStatus && managementError.httpStatus >= 400 ? managementError.httpStatus : 502;
    return NextResponse.json({ ok: false, error: managementError.message }, { status });
  }
}
