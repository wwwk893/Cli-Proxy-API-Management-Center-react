import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import readline from "node:readline";

import { prisma } from "./db";
import { calcCostUsd } from "./pricing";
import { loadPricingMap } from "./pricing-map";
import { normalizeModel } from "./usage/model-normalize";

type CodexTokenUsageLike = Record<string, unknown>;

type NormalizedTokenUsage = {
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  totalTokens: number;
};

type UsageEventInput = {
  rawKey: string;
  eventTime: Date;
  apiPath: string;
  model: string;
  modelRaw?: string | null;
  modelCanonical?: string | null;
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

export type CodexIngestOptions = {
  codexHome?: string;
  deviceId?: string;
  backfillSince?: Date;
  maxEvents?: number;
  dryRun?: boolean;
};

export type CodexIngestResult = {
  inserted: number;
  skipped: number;
  processed: number;
  cursorAfter?: Date | null;
  filesScanned: number;
  filesParsed: number;
};

type SessionContext = {
  sessionId: string | null;
  cwd: string | null;
  originator: string | null;
  cliVersion: string | null;
  effort: string | null;
  model: string | null;
  prevTotalUsage: NormalizedTokenUsage | null;
};

function buildEventDedupKey(params: {
  sessionId: string | null;
  eventTime: Date;
  model: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  totalTokens: number;
}) {
  return [
    "codex",
    params.sessionId ?? "unknown",
    params.eventTime.toISOString(),
    params.model,
    params.inputTokens,
    params.outputTokens,
    params.reasoningTokens,
    params.cachedTokens,
    params.totalTokens,
  ].join(":");
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function getFirstString(obj: any, paths: string[]): string | null {
  for (const p of paths) {
    const parts = p.split(".");
    let cur: any = obj;
    for (const part of parts) {
      if (!cur || typeof cur !== "object") {
        cur = undefined;
        break;
      }
      cur = cur[part];
    }
    if (typeof cur === "string" && cur.trim() !== "") return cur;
  }
  return null;
}

function normalizeUsage(raw: CodexTokenUsageLike | null | undefined): NormalizedTokenUsage | null {
  if (!raw || typeof raw !== "object") return null;
  const inputTokens =
    toNumber((raw as any).input_tokens ?? (raw as any).inputTokens ?? (raw as any).input);
  const cachedTokens =
    toNumber(
      (raw as any).cached_input_tokens ??
        (raw as any).cached_tokens ??
        (raw as any).cachedTokens ??
        (raw as any).cached,
    );
  const outputTokens =
    toNumber((raw as any).output_tokens ?? (raw as any).outputTokens ?? (raw as any).output);
  const reasoningTokens =
    toNumber(
      (raw as any).reasoning_output_tokens ??
        (raw as any).reasoning_tokens ??
        (raw as any).reasoningTokens ??
        (raw as any).reasoning,
    );
  const totalTokens =
    toNumber((raw as any).total_tokens ?? (raw as any).totalTokens) ||
    inputTokens + outputTokens;

  return { inputTokens, cachedTokens, outputTokens, reasoningTokens, totalTokens };
}

function diffUsage(total: NormalizedTokenUsage, prev: NormalizedTokenUsage | null): NormalizedTokenUsage {
  if (!prev) return total;
  return {
    inputTokens: Math.max(0, total.inputTokens - prev.inputTokens),
    cachedTokens: Math.max(0, total.cachedTokens - prev.cachedTokens),
    outputTokens: Math.max(0, total.outputTokens - prev.outputTokens),
    reasoningTokens: Math.max(0, total.reasoningTokens - prev.reasoningTokens),
    totalTokens: Math.max(0, total.totalTokens - prev.totalTokens),
  };
}

async function listRolloutFiles(codexHome: string): Promise<Array<{ filePath: string; mtime: Date }>> {
  const sessionsDir = path.join(codexHome, "sessions");
  try {
    await fs.promises.access(sessionsDir, fs.constants.R_OK);
  } catch {
    return [];
  }

  const result: Array<{ filePath: string; mtime: Date }> = [];

  async function walk(dir: string) {
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!/^rollout-.*\.jsonl$/i.test(entry.name)) continue;
      const stat = await fs.promises.stat(full);
      result.push({ filePath: full, mtime: stat.mtime });
    }
  }

  await walk(sessionsDir);
  result.sort((a, b) => a.mtime.getTime() - b.mtime.getTime());
  return result;
}

async function getCursor(cursorId: string) {
  const row = await prisma.usageIngestCursor.findUnique({ where: { id: cursorId } });
  return row?.lastEventAt ?? null;
}

async function updateCursor(cursorId: string, lastEventAt: Date) {
  await prisma.usageIngestCursor.upsert({
    where: { id: cursorId },
    update: { lastEventAt },
    create: { id: cursorId, lastEventAt },
  });
}

function extractEventType(obj: any): string | null {
  const t = obj?.type ?? obj?.event ?? obj?.name ?? obj?.payload?.type;
  return typeof t === "string" ? t : null;
}

function extractTimestamp(obj: any): Date | null {
  const tsStr = getFirstString(obj, [
    "timestamp",
    "ts",
    "time",
    "created_at",
    "createdAt",
    "payload.timestamp",
    "payload.ts",
    "payload.time",
  ]);
  if (tsStr) {
    const d = new Date(tsStr);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const tsNum = obj?.timestamp ?? obj?.ts ?? obj?.time;
  if (typeof tsNum === "number") {
    const d = new Date(tsNum);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function extractSessionMeta(obj: any, ctx: SessionContext) {
  const sessionId = getFirstString(obj, [
    // Codex CLI 当前格式：session_meta.payload.id
    "id",
    "session_id",
    "sessionId",
    "payload.id",
    "payload.session_id",
    "payload.sessionId",
    "meta.id",
    "meta.session_id",
    "meta.sessionId",
  ]);
  const cwd = getFirstString(obj, [
    "cwd",
    "payload.cwd",
    "meta.cwd",
    "working_directory",
    "repository",
    "repo",
  ]);
  const originator = getFirstString(obj, [
    "originator",
    "payload.originator",
    "meta.originator",
    "client",
    "client.name",
  ]);
  const cliVersion = getFirstString(obj, [
    "cli_version",
    "cliVersion",
    "payload.cli_version",
    "payload.cliVersion",
    "meta.cli_version",
    "meta.cliVersion",
  ]);

  if (sessionId) ctx.sessionId = sessionId;
  if (cwd) ctx.cwd = cwd;
  if (originator) ctx.originator = originator;
  if (cliVersion) ctx.cliVersion = cliVersion;
}

function extractTurnContext(obj: any, ctx: SessionContext) {
  const model = getFirstString(obj, [
    "model",
    "payload.model",
    "turn_context.model",
    "context.model",
  ]);
  const effort = getFirstString(obj, [
    "effort",
    "payload.effort",
    "turn_context.effort",
    "context.effort",
  ]);
  if (model) ctx.model = model;
  if (effort) ctx.effort = effort;
}

function extractTokenInfo(obj: any): { last: NormalizedTokenUsage | null; total: NormalizedTokenUsage | null } {
  const info = obj?.payload?.info ?? obj?.info ?? obj?.payload?.token_usage ?? obj?.token_usage;
  const lastRaw = info?.last_token_usage ?? info?.lastTokenUsage ?? obj?.payload?.last_token_usage;
  const totalRaw = info?.total_token_usage ?? info?.totalTokenUsage ?? obj?.payload?.total_token_usage;

  return {
    last: normalizeUsage(lastRaw),
    total: normalizeUsage(totalRaw),
  };
}

async function parseRolloutFile(params: {
  filePath: string;
  cursor: Date | null;
  deviceId: string;
  pricingMap: Awaited<ReturnType<typeof loadPricingMap>>;
  maxEvents: number;
  seenEventKeys?: Set<string>;
}): Promise<UsageEventInput[]> {
  const { filePath, cursor, deviceId, pricingMap, maxEvents } = params;
  const events: UsageEventInput[] = [];
  const seenEventKeys = params.seenEventKeys ?? new Set<string>();

  const ctx: SessionContext = {
    sessionId: null,
    cwd: null,
    originator: null,
    cliVersion: null,
    effort: null,
    model: null,
    prevTotalUsage: null,
  };

  const stream = fs.createReadStream(filePath, { encoding: "utf8" });
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });
  let lineNo = 0;
  let rootSessionId: string | null = null;

  for await (const line of rl) {
    if (events.length >= maxEvents) break;
    const trimmed = line.trim();
    lineNo++;
    if (!trimmed) continue;

    let obj: any;
    try {
      obj = JSON.parse(trimmed);
    } catch {
      continue;
    }

    const type = extractEventType(obj);
    if (!type) continue;

    if (type === "session_meta") {
      extractSessionMeta(obj, ctx);
      if (!rootSessionId && ctx.sessionId) {
        rootSessionId = ctx.sessionId;
      }
      continue;
    }

    if (type === "turn_context") {
      extractTurnContext(obj, ctx);
      continue;
    }

    const isTokenCount = type === "token_count" || obj?.payload?.type === "token_count";
    if (!isTokenCount) continue;

    const eventTime = extractTimestamp(obj);
    if (!eventTime) continue;
    if (cursor && eventTime <= cursor) continue;

    const { last, total } = extractTokenInfo(obj);
    let lastUsage = last;
    if (!lastUsage && total) {
      lastUsage = diffUsage(total, ctx.prevTotalUsage);
    }
    if (total) {
      ctx.prevTotalUsage = total;
    }
    if (!lastUsage) continue;

    // Forked rollout files can replay ancestor session history by emitting an
    // extra `session_meta` for the source thread before a burst of old
    // `token_count` entries. Only the first session in the file is treated as
    // the live session; replayed ancestor sessions are skipped.
    if (rootSessionId && ctx.sessionId && ctx.sessionId !== rootSessionId) {
      continue;
    }

    const model = ctx.model ?? getFirstString(obj, ["model", "payload.model", "info.model"]) ?? "unknown";
    const normalized = normalizeModel({ model, effort: ctx.effort });
    const inputTokens = lastUsage.inputTokens;
    const outputTokens = lastUsage.outputTokens;
    const reasoningTokens = lastUsage.reasoningTokens;
    const cachedTokens = lastUsage.cachedTokens;
    const totalTokens = lastUsage.totalTokens || inputTokens + outputTokens;

    const billableInput = Math.max(0, inputTokens - cachedTokens);
    const costUsd = calcCostUsd({
      model,
      inputTokens: billableInput,
      outputTokens,
      cachedTokens,
      reasoningTokens: 0,
      pricingMap,
    });

    const dedupKey = buildEventDedupKey({
      sessionId: ctx.sessionId,
      eventTime,
      model,
      inputTokens,
      outputTokens,
      reasoningTokens,
      cachedTokens,
      totalTokens,
    });
    if (seenEventKeys.has(dedupKey)) {
      continue;
    }
    seenEventKeys.add(dedupKey);

    const rawKey = `codex:${deviceId}:${ctx.sessionId ?? "unknown"}:${eventTime.toISOString()}:${lineNo}`;

    events.push({
      rawKey,
      eventTime,
      apiPath: "codex-cli",
      model,
      modelRaw: normalized.modelRaw,
      modelCanonical: normalized.modelCanonical,
      proxyHost: deviceId,
      status: "completed",
      inputTokens,
      outputTokens,
      reasoningTokens,
      cachedTokens,
      totalTokens,
      costUsd,
      authSource: null,
      authIndex: null,
      authFailed: false,
      sourceType: "codex",
      sessionId: ctx.sessionId,
      cwd: ctx.cwd,
      originator: ctx.originator,
      cliVersion: ctx.cliVersion,
      effort: normalized.effort,
    });
  }

  return events;
}

export async function ingestUsageFromCodex(options: CodexIngestOptions = {}): Promise<CodexIngestResult> {
  const codexHome =
    options.codexHome ??
    process.env.CODEX_HOME ??
    path.join(os.homedir(), ".codex");
  const deviceId =
    options.deviceId ??
    process.env.CODEX_DEVICE_ID ??
    os.hostname();
  const maxEvents =
    options.maxEvents ??
    (() => {
      const raw = process.env.CODEX_INGEST_MAX_EVENTS_PER_RUN ?? process.env.USAGE_INGEST_MAX_EVENTS_PER_RUN;
      const n = raw ? Number(raw) : 2000;
      return Number.isFinite(n) && n > 0 ? n : 2000;
    })();
  const dryRun =
    options.dryRun ??
    (() => {
      const raw = process.env.CODEX_INGEST_DRY_RUN;
      return raw === "true";
    })();

  const pricingMap = await loadPricingMap();
  const cursorId = `codex:${deviceId}`;
  const cursor = options.backfillSince ?? (await getCursor(cursorId));

  const files = await listRolloutFiles(codexHome);
  const candidateFiles = cursor ? files.filter((f) => f.mtime > cursor) : files;

  console.log("codex:ingest scan", {
    codexHome,
    deviceId,
    cursor,
    filesTotal: files.length,
    candidateFiles: candidateFiles.length,
  });

  const events: UsageEventInput[] = [];
  const seenEventKeys = new Set<string>();
  let filesParsed = 0;

  for (const f of candidateFiles) {
    if (events.length >= maxEvents) break;
    const remaining = maxEvents - events.length;
    const parsed = await parseRolloutFile({
      filePath: f.filePath,
      cursor,
      deviceId,
      pricingMap,
      maxEvents: remaining,
      seenEventKeys,
    });
    filesParsed++;
    events.push(...parsed);
  }

  let inserted = 0;
  let skipped = 0;
  let cursorAfter = cursor;

  if (!dryRun) {
    const result = await prisma.$transaction(async (tx) => {
      let latest = cursor ?? null;
      if (events.length > 0) {
        const res = await tx.usageEvent.createMany({ data: events, skipDuplicates: true });
        inserted = res.count;
        skipped = events.length - res.count;
        latest = events.reduce(
          (max, e) => (max && max > e.eventTime ? max : e.eventTime),
          latest ?? events[0].eventTime,
        );
      }

      if (latest) {
        await updateCursor(cursorId, latest);
      }
      return { latest };
    });
    cursorAfter = result.latest;
  }

  console.log("codex:ingest result", {
    inserted,
    skipped,
    processed: events.length,
    cursorAfter,
    filesScanned: files.length,
    filesParsed,
  });

  return {
    inserted,
    skipped,
    processed: events.length,
    cursorAfter,
    filesScanned: files.length,
    filesParsed,
  };
}
