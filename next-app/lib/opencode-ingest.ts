import fs from "node:fs";
import path from "node:path";
import os from "node:os";

import { prisma } from "./db";
import { calcCostUsd } from "./pricing";
import { loadPricingMap } from "./pricing-map";
import { normalizeModel } from "./usage/model-normalize";

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

type OpencodeMessage = {
  id?: unknown;
  sessionID?: unknown;
  role?: unknown;
  providerID?: unknown;
  modelID?: unknown;
  time?: { created?: unknown; completed?: unknown } | unknown;
  tokens?: {
    input?: unknown;
    output?: unknown;
    reasoning?: unknown;
    cache?: { read?: unknown; write?: unknown } | unknown;
  } | unknown;
  cost?: unknown;
  error?: unknown;
  path?: { cwd?: unknown } | unknown;
  agent?: unknown;
};

export type OpencodeIngestOptions = {
  // OpenCode 本地数据默认路径：~/.local/share/opencode/storage/message
  messageDir?: string;
  deviceId?: string;
  backfillSince?: Date;
  maxEvents?: number;
  dryRun?: boolean;
};

export type OpencodeIngestResult = {
  inserted: number;
  skipped: number;
  processed: number;
  cursorAfter?: Date | null;
  filesScanned: number;
  filesParsed: number;
};

function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function parseTimestamp(value: unknown): Date | null {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return null;
    // OpenCode message.time 通常是 epoch ms；兜底兼容 epoch seconds
    const ms = value > 1_000_000_000_000 ? value : value * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

async function listMessageFiles(messageDir: string): Promise<Array<{ filePath: string; mtime: Date }>> {
  try {
    await fs.promises.access(messageDir, fs.constants.R_OK);
  } catch {
    return [];
  }

  const sessionDirs = await fs.promises.readdir(messageDir, { withFileTypes: true });
  const result: Array<{ filePath: string; mtime: Date }> = [];

  for (const entry of sessionDirs) {
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith(".")) continue;
    const sessionDir = path.join(messageDir, entry.name);

    let files: fs.Dirent[] = [];
    try {
      files = await fs.promises.readdir(sessionDir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const f of files) {
      if (!f.isFile()) continue;
      if (!f.name.toLowerCase().endsWith(".json")) continue;
      const filePath = path.join(sessionDir, f.name);
      try {
        const stat = await fs.promises.stat(filePath);
        result.push({ filePath, mtime: stat.mtime });
      } catch {
        // ignore stat errors
      }
    }
  }

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

function extractEventTime(message: OpencodeMessage): Date | null {
  const time = message.time as any;
  if (!time || typeof time !== "object") return null;
  return parseTimestamp(time.completed) ?? parseTimestamp(time.created);
}

function parseMessageToUsageEvent(params: {
  message: OpencodeMessage;
  pricingMap: Awaited<ReturnType<typeof loadPricingMap>>;
}): UsageEventInput | null {
  const { message, pricingMap } = params;

  const role = asString(message.role);
  if (role !== "assistant") return null;

  const sessionId = asString(message.sessionID);
  const messageId = asString(message.id);
  if (!sessionId || !messageId) return null;

  const eventTime = extractEventTime(message);
  if (!eventTime) return null;

  const model = asString(message.modelID) ?? "unknown";
  const proxyHost = asString(message.providerID) ?? "unknown";
  const cwd = typeof message.path === "object" && message.path ? asString((message.path as any).cwd) : null;

  const tokens = (message.tokens && typeof message.tokens === "object" ? (message.tokens as any) : {}) as any;
  const cache = tokens.cache && typeof tokens.cache === "object" ? tokens.cache : {};

  const inputTokens = toNumber(tokens.input);
  const outputTokens = toNumber(tokens.output);
  const reasoningTokens = toNumber(tokens.reasoning);
  const cachedTokens = toNumber(cache.read) + toNumber(cache.write);
  const totalTokens = inputTokens + outputTokens + reasoningTokens + cachedTokens;

  const costRaw = toNumber(message.cost);
  const costUsd =
    costRaw > 0
      ? costRaw
      : calcCostUsd({
          model,
          inputTokens,
          outputTokens,
          reasoningTokens,
          cachedTokens,
          pricingMap,
        });

  const hasError = Boolean(message.error);
  const status = hasError ? "error" : "completed";
  const normalized = normalizeModel({ model });

  return {
    rawKey: `opencode:${sessionId}:${messageId}`,
    eventTime,
    apiPath: "opencode-cli",
    model,
    modelRaw: normalized.modelRaw,
    modelCanonical: normalized.modelCanonical,
    proxyHost,
    status,
    inputTokens,
    outputTokens,
    reasoningTokens,
    cachedTokens,
    totalTokens,
    costUsd,
    authSource: null,
    authIndex: null,
    authFailed: false,
    sourceType: "opencode",
    sessionId,
    cwd,
    originator: asString(message.agent),
    cliVersion: null,
    effort: normalized.effort,
  };
}

export async function ingestUsageFromOpencode(options: OpencodeIngestOptions = {}): Promise<OpencodeIngestResult> {
  const defaultMessageDir = path.join(os.homedir(), ".local", "share", "opencode", "storage", "message");
  const messageDir = options.messageDir ?? process.env.OPENCODE_MESSAGE_DIR ?? defaultMessageDir;

  const deviceId = options.deviceId ?? process.env.OPENCODE_DEVICE_ID ?? os.hostname();
  const maxEvents =
    options.maxEvents ??
    (() => {
      const raw = process.env.OPENCODE_INGEST_MAX_EVENTS_PER_RUN ?? process.env.USAGE_INGEST_MAX_EVENTS_PER_RUN;
      const n = raw ? Number(raw) : 2000;
      return Number.isFinite(n) && n > 0 ? n : 2000;
    })();
  const dryRun =
    options.dryRun ??
    (() => {
      const raw = process.env.OPENCODE_INGEST_DRY_RUN;
      return raw === "true";
    })();

  const pricingMap = await loadPricingMap();
  const cursorId = `opencode:${deviceId}`;
  const cursor = options.backfillSince ?? (await getCursor(cursorId));

  const files = await listMessageFiles(messageDir);
  const candidateFiles = cursor ? files.filter((f) => f.mtime > cursor) : files;

  console.log("opencode:ingest scan", {
    messageDir,
    deviceId,
    cursor,
    filesTotal: files.length,
    candidateFiles: candidateFiles.length,
  });

  const events: UsageEventInput[] = [];
  let filesParsed = 0;
  let lastScannedMtime: Date | null = null;
  let reachedLimit = false;

  for (const f of candidateFiles) {
    if (events.length >= maxEvents) {
      reachedLimit = true;
      break;
    }
    lastScannedMtime = f.mtime;

    let raw: string;
    try {
      raw = await fs.promises.readFile(f.filePath, "utf8");
    } catch {
      continue;
    }
    filesParsed++;

    let msg: OpencodeMessage;
    try {
      msg = JSON.parse(raw) as OpencodeMessage;
    } catch {
      continue;
    }

    const evt = parseMessageToUsageEvent({ message: msg, pricingMap });
    if (evt) events.push(evt);
  }

  let inserted = 0;
  let skipped = 0;
  let cursorAfter = cursor;

  const cursorCandidate =
    lastScannedMtime &&
    (reachedLimit
      ? new Date(lastScannedMtime.getTime() - 1) // 防止相同 mtime 下因 maxEvents 截断导致遗漏
      : lastScannedMtime);

  if (!dryRun) {
    const result = await prisma.$transaction(async (tx) => {
      if (events.length > 0) {
        const rawKeys = events.map((e) => e.rawKey);
        const existing = await tx.usageEvent.findMany({
          where: { rawKey: { in: rawKeys } },
          select: { rawKey: true },
        });
        const existingSet = new Set(existing.map((r) => r.rawKey));
        const toCreate = events.filter((e) => !existingSet.has(e.rawKey));
        const toUpdate = events.filter((e) => existingSet.has(e.rawKey));

        if (toCreate.length > 0) {
          const res = await tx.usageEvent.createMany({ data: toCreate, skipDuplicates: true });
          inserted += res.count;
        }
        skipped = events.length - inserted;

        for (const e of toUpdate) {
          await tx.usageEvent.update({
            where: { rawKey: e.rawKey },
            data: {
              eventTime: e.eventTime,
              apiPath: e.apiPath,
              model: e.model,
              modelRaw: e.modelRaw,
              modelCanonical: e.modelCanonical,
              proxyHost: e.proxyHost,
              status: e.status,
              inputTokens: e.inputTokens,
              outputTokens: e.outputTokens,
              reasoningTokens: e.reasoningTokens,
              cachedTokens: e.cachedTokens,
              totalTokens: e.totalTokens,
              costUsd: e.costUsd as any,
              authSource: e.authSource,
              authIndex: e.authIndex,
              authFailed: e.authFailed,
              sourceType: e.sourceType,
              sessionId: e.sessionId,
              cwd: e.cwd,
              originator: e.originator,
              cliVersion: e.cliVersion,
              effort: e.effort,
            },
          });
        }
      }

      if (cursorCandidate) {
        await updateCursor(cursorId, cursorCandidate);
      }

      return { latest: cursorCandidate ?? cursor };
    });
    cursorAfter = result.latest;
  } else {
    cursorAfter = cursorCandidate ?? cursor;
  }

  console.log("opencode:ingest result", {
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
