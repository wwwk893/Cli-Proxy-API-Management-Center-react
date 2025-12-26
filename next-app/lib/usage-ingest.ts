import { prisma } from "./db";
import { fetchUsageRaw } from "./cliproxy-client";
import { serverEnv } from "@/lib/env";
import { calcCostUsd, DEFAULT_PRICING, type PricingMap } from "./pricing";

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
  sessionId?: string | null;
  cwd?: string | null;
  originator?: string | null;
  cliVersion?: string | null;
  effort?: string | null;
};

export type IngestOptions = {
  backfillSince?: Date;
  maxEvents?: number;
  dryRun?: boolean;
  proxyHost: string;
};

export type IngestResult = {
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
  return row?.lastEventAt ?? null;
}

async function updateCursor(lastEventAt: Date) {
  await prisma.usageIngestCursor.upsert({
    where: { id: "cliproxy" },
    update: { lastEventAt },
    create: { id: "cliproxy", lastEventAt },
  });
}

export async function ingestUsageFromProxy(options: IngestOptions): Promise<IngestResult> {
  const {
    backfillSince = serverEnv.USAGE_INGEST_BACKFILL_SINCE,
    maxEvents = serverEnv.USAGE_INGEST_MAX_EVENTS_PER_RUN,
    dryRun = serverEnv.USAGE_INGEST_DRY_RUN,
    proxyHost,
  } = options;

  const payload = (await fetchUsageRaw()) as CliproxyUsagePayload;
  const usage = payload?.usage;
  const cursor = backfillSince ?? (await getCursor());

  const pricingRows = await prisma.modelPricing.findMany();
  const pricingMap: PricingMap = { ...DEFAULT_PRICING };
  pricingRows.forEach((row) => {
    pricingMap[row.modelId] = {
      inputPerMillion: Number(row.inputCost ?? 0),
      outputPerMillion: Number(row.outputCost ?? 0),
      cachedPerMillion: Number(row.cachedCost ?? 0),
    };
  });

  console.log("usage:ingest payload", {
    payloadCursor: payload?.cursor,
    windowStart: payload?.window_start,
    windowEnd: payload?.window_end,
    apiCount: Object.keys(usage?.apis ?? {}).length,
  });

  if (!usage || !usage.apis) {
    console.log("usage:ingest no usage.apis", { cursor });
    return { inserted: 0, skipped: 0, processed: 0, cursorAfter: cursor };
  }

  const events: UsageEventInput[] = [];
  let totalDetails = 0;
  let skippedNoTimestamp = 0;
  let skippedByCursor = 0;
  let parsedOk = 0;
  let minTimestamp: Date | null = null;
  let maxTimestamp: Date | null = null;

  for (const [apiPath, apiStats] of Object.entries(usage.apis ?? {})) {
    const models = apiStats.models ?? {};
    for (const [model, modelStats] of Object.entries(models)) {
      const details = modelStats.details ?? [];
      for (const d of details) {
        totalDetails++;
        if (events.length >= maxEvents) break;
        const ts = d.timestamp;
        const eventDate = parseDateSafe(ts);
        if (!eventDate) {
          skippedNoTimestamp++;
          continue;
        }
        if (cursor && eventDate <= cursor) {
          skippedByCursor++;
          continue; // already ingested
        }

        const authIndexRaw = d.auth_index;
        const authIndexNum =
          typeof authIndexRaw === "number"
            ? authIndexRaw
            : typeof authIndexRaw === "string" && authIndexRaw.trim() !== ""
              ? Number(authIndexRaw)
              : null;
        const authIndex = Number.isFinite(authIndexNum) ? Number(authIndexNum) : null;

        parsedOk++;
        if (!minTimestamp || eventDate < minTimestamp) minTimestamp = eventDate;
        if (!maxTimestamp || eventDate > maxTimestamp) maxTimestamp = eventDate;

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

        const rawKey = `${proxyHost}-${apiPath}-${model}-${ts}`;

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

  console.log("usage:ingest detail stats", {
    cursor,
    totalDetails,
    parsedOk,
    skippedNoTimestamp,
    skippedByCursor,
    eventsLength: events.length,
    minTimestamp,
    maxTimestamp,
  });

  let inserted = 0;
  let skipped = 0;
  if (!dryRun) {
    // Transaction keeps events + cursor consistent
    const result = await prisma.$transaction(async (tx) => {
      let latest = cursor ?? null;

      if (events.length > 0) {
        const res = await tx.usageEvent.createMany({ data: events, skipDuplicates: true });
        inserted = res.count;
        skipped = events.length - res.count;
        latest = events.reduce((max, e) => (max && max > e.eventTime ? max : e.eventTime), latest ?? events[0].eventTime);
      }

      // Advance cursor if we saw later events or if upstream provided a window_end
      const cursorCandidate = latest ?? parseDateSafe(payload.window_end ?? "") ?? cursor;
      if (cursorCandidate) {
        await updateCursor(cursorCandidate);
      }

      return { latest: cursorCandidate };
    });

    return { inserted, skipped, processed: events.length, cursorAfter: result.latest };
  }

  return { inserted, skipped, processed: events.length, cursorAfter: cursor };
}
