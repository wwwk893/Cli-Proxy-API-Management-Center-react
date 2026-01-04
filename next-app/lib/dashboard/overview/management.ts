import "server-only";

import type { PrismaClient } from "@prisma/client";

import { fetchManagementJsonWithConfig, fetchManagementRawWithConfig, toManagementError, type ManagementConfig } from "@/lib/management/client";
import { CODEX_API_PATHS } from "@/lib/usage/aggregation-constants";
import type { DashboardChannel, DashboardConfigHealth, DashboardPartialError, DashboardSystemHealth } from "./types";
import type { DashboardResolvedRange } from "./range";
import { Prisma } from "@prisma/client";

function pickHeader(headers: Headers, key: string) {
  return headers.get(key) || headers.get(key.toLowerCase());
}

function asBoolean(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function asNumber(value: unknown, fallback: number) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function countList(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function startOfUtcDay(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function toEventChannelFilter(channel: DashboardChannel) {
  if (channel === "all") return Prisma.sql``;
  return Prisma.sql`AND "sourceType" = ${channel}::text`;
}

export async function fetchSystemHealth(
  config: ManagementConfig,
  opts: { signal?: AbortSignal } = {},
): Promise<DashboardSystemHealth> {
  const res = await fetchManagementRawWithConfig(config, "/debug", { method: "GET", signal: opts.signal });
  const serverVersion = pickHeader(res.headers, "X-CPA-VERSION");
  const serverBuildDate = pickHeader(res.headers, "X-CPA-BUILD-DATE");

  return {
    connected: true,
    managementBase: config.serverBase,
    serverVersion: serverVersion || null,
    serverBuildDate: serverBuildDate || null,
  };
}

type LogsResponse = {
  lines: string[];
  "latest-timestamp"?: string;
  "line-count"?: number;
};

export async function fetchLogsMeta(
  config: ManagementConfig,
  opts: { signal?: AbortSignal } = {},
): Promise<{ latestTimestamp: string | null; lineCount: number | null }> {
  const { data } = await fetchManagementJsonWithConfig<LogsResponse>(config, "/logs?limit=1", { method: "GET", signal: opts.signal });

  const latestTimestamp = typeof data["latest-timestamp"] === "string" ? data["latest-timestamp"] : null;
  const lineCount = typeof data["line-count"] === "number" ? data["line-count"] : null;

  return { latestTimestamp, lineCount };
}

async function readApiKeysCount(config: ManagementConfig, signal?: AbortSignal): Promise<number> {
  const { data } = await fetchManagementJsonWithConfig<Record<string, unknown>>(config, "/api-keys", { method: "GET", signal });
  return countList(data["api-keys"]);
}

async function readProviderLists(config: ManagementConfig, signal?: AbortSignal): Promise<{
  geminiCount: number;
  codexCount: number;
  claudeCount: number;
  openaiCompatCount: number;
  openaiCompatKeysCount: number;
}> {
  const [gemini, codex, claude, openai] = await Promise.all([
    fetchManagementJsonWithConfig<Record<string, unknown>>(config, "/gemini-api-key", { method: "GET", signal }),
    fetchManagementJsonWithConfig<Record<string, unknown>>(config, "/codex-api-key", { method: "GET", signal }),
    fetchManagementJsonWithConfig<Record<string, unknown>>(config, "/claude-api-key", { method: "GET", signal }),
    fetchManagementJsonWithConfig<Record<string, unknown>>(config, "/openai-compatibility", { method: "GET", signal }),
  ]);

  const geminiRaw = gemini.data["gemini-api-key"];
  const codexRaw = codex.data["codex-api-key"];
  const claudeRaw = claude.data["claude-api-key"];
  const openaiRaw = openai.data["openai-compatibility"];

  const openaiProviders = Array.isArray(openaiRaw) ? openaiRaw.map((item) => asRecord(item)) : [];
  const openaiCompatKeysCount = openaiProviders.reduce((acc, provider) => {
    const entries = provider["api-key-entries"];
    if (Array.isArray(entries)) return acc + entries.length;
    const legacyKeys = provider["api-keys"];
    if (Array.isArray(legacyKeys)) return acc + legacyKeys.length;
    return acc;
  }, 0);

  return {
    geminiCount: countList(geminiRaw),
    codexCount: countList(codexRaw),
    claudeCount: countList(claudeRaw),
    openaiCompatCount: countList(openaiRaw),
    openaiCompatKeysCount,
  };
}

async function readSettingsSummary(config: ManagementConfig, signal?: AbortSignal): Promise<{
  usageStatisticsEnabled: boolean;
  requestLog: boolean;
  wsAuth: boolean;
  loggingToFile: boolean;
  requestRetry: number;
}> {
  const { data } = await fetchManagementJsonWithConfig<Record<string, unknown>>(config, "/config", { method: "GET", signal });

  return {
    usageStatisticsEnabled: asBoolean(data["usage-statistics-enabled"]),
    requestLog: asBoolean(data["request-log"]),
    wsAuth: asBoolean(data["ws-auth"]),
    loggingToFile: asBoolean(data["logging-to-file"]),
    requestRetry: asNumber(data["request-retry"], 0),
  };
}

async function computePricingCoverage(params: {
  prisma: PrismaClient;
  range: DashboardResolvedRange;
  channel: DashboardChannel;
}): Promise<{
  configuredModelsCount: number;
  usedModelsCount: number;
  missingModelsCount: number;
  missingModelsTop: string[];
}> {
  const { prisma, range, channel } = params;

  const configuredRows = await prisma.modelPricing.findMany({ select: { modelId: true } });
  const configuredSet = new Set(configuredRows.map((row) => row.modelId));

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

  const [dailyModels, eventModels] = await Promise.all([
    useDaily
      ? prisma.usageDaily.findMany({
          where: {
            date: {
              ...(dailyFrom ? { gte: dailyFrom } : {}),
              ...(dailyTo ? { lte: dailyTo } : {}),
            },
            ...(channel === "codex"
              ? { apiPath: { in: [...CODEX_API_PATHS] } }
              : channel === "cliproxy"
                ? { apiPath: { notIn: [...CODEX_API_PATHS] } }
                : {}),
          },
          distinct: ["model"],
          select: { model: true },
        })
      : Promise.resolve([] as Array<{ model: string | null }>),
    includeEvents
      ? prisma.usageEvent.findMany({
          where: {
            eventTime: {
              ...(eventFrom ? { gte: eventFrom } : {}),
              ...(eventTo ? { lte: eventTo } : {}),
            },
            ...(channel === "all" ? {} : { sourceType: channel }),
          },
          distinct: ["model"],
          select: { model: true },
        })
      : Promise.resolve([] as Array<{ model: string | null }>),
  ]);

  const usedModelsSet = new Set<string>();
  for (const row of [...dailyModels, ...eventModels]) {
    const model = (row as any)?.model;
    if (typeof model === "string" && model.trim()) usedModelsSet.add(model);
  }

  const missingModels = Array.from(usedModelsSet).filter((m) => !configuredSet.has(m));
  const missingSet = new Set(missingModels);

  // missingTop5：优先按成本从高到低选取；如不足则按字母序补齐。
  type CostRow = { model: string; costUsd: any };

  const costSources: Prisma.Sql[] = [];

  if (includeEvents) {
    costSources.push(Prisma.sql`
      SELECT "model" AS model, "costUsd" AS "costUsd"
      FROM "UsageEvent"
      WHERE
        (${eventFrom ?? null}::timestamptz IS NULL OR "eventTime" >= ${eventFrom ?? null}::timestamptz)
        AND (${eventTo ?? null}::timestamptz IS NULL OR "eventTime" <= ${eventTo ?? null}::timestamptz)
        ${channelEventFilter}
    `);
  }

  if (useDaily) {
    costSources.push(Prisma.sql`
      SELECT "model" AS model, "costUsd" AS "costUsd"
      FROM "UsageDaily"
      WHERE
        (${dailyFrom ?? null}::timestamptz IS NULL OR "date" >= ${dailyFrom ?? null}::timestamptz)
        AND (${dailyTo ?? null}::timestamptz IS NULL OR "date" <= ${dailyTo ?? null}::timestamptz)
        ${codexDailyFilter}
    `);
  }

  const costRows = costSources.length
    ? await prisma.$queryRaw<CostRow[]>`
        SELECT model, SUM("costUsd") AS "costUsd" FROM (
          ${Prisma.join(costSources, " UNION ALL ")}
        ) t
        GROUP BY model
        ORDER BY SUM("costUsd") DESC
        LIMIT 500
      `
    : ([] as CostRow[]);

  const missingTop: string[] = [];
  for (const row of costRows) {
    if (!row.model || !missingSet.has(row.model)) continue;
    missingTop.push(row.model);
    if (missingTop.length >= 5) break;
  }

  if (missingTop.length < 5) {
    const remaining = missingModels
      .filter((m) => !missingTop.includes(m))
      .sort((a, b) => a.localeCompare(b))
      .slice(0, 5 - missingTop.length);
    missingTop.push(...remaining);
  }

  return {
    configuredModelsCount: configuredSet.size,
    usedModelsCount: usedModelsSet.size,
    missingModelsCount: missingModels.length,
    missingModelsTop: missingTop,
  };
}

export async function fetchConfigHealth(params: {
  config: ManagementConfig;
  prisma: PrismaClient;
  range: DashboardResolvedRange;
  channel: DashboardChannel;
  signal?: AbortSignal;
}): Promise<{ configHealth: DashboardConfigHealth; partialErrors: DashboardPartialError[] }> {
  const { config, prisma, range, channel, signal } = params;

  const partialErrors: DashboardPartialError[] = [];

  const [apiKeysRes, providersRes, settingsRes, pricingRes] = await Promise.allSettled([
    readApiKeysCount(config, signal),
    readProviderLists(config, signal),
    readSettingsSummary(config, signal),
    computePricingCoverage({ prisma, range, channel }),
  ]);

  const apiKeysCount =
    apiKeysRes.status === "fulfilled"
      ? apiKeysRes.value
      : (() => {
          const e = toManagementError(apiKeysRes.reason);
          partialErrors.push({
            source: "config",
            code: `API_KEYS_${e.code}`,
            message: e.message,
            httpStatus: e.httpStatus,
            retryable: e.retryable,
          });
          return null;
        })();

  const providersSummary = {
    geminiCount: null as number | null,
    codexCount: null as number | null,
    claudeCount: null as number | null,
    openaiCompatCount: null as number | null,
    totalUpstreamKeysCount: null as number | null,
  };

  if (providersRes.status === "fulfilled") {
    const { geminiCount, codexCount, claudeCount, openaiCompatCount, openaiCompatKeysCount } = providersRes.value;
    providersSummary.geminiCount = geminiCount;
    providersSummary.codexCount = codexCount;
    providersSummary.claudeCount = claudeCount;
    providersSummary.openaiCompatCount = openaiCompatCount;
    providersSummary.totalUpstreamKeysCount = geminiCount + codexCount + claudeCount + openaiCompatKeysCount;
  } else {
    const e = toManagementError(providersRes.reason);
    partialErrors.push({
      source: "config",
      code: `PROVIDERS_${e.code}`,
      message: e.message,
      httpStatus: e.httpStatus,
      retryable: e.retryable,
    });
  }

  const settingsSummary = {
    usageStatisticsEnabled: null as boolean | null,
    requestLog: null as boolean | null,
    wsAuth: null as boolean | null,
    loggingToFile: null as boolean | null,
    requestRetry: null as number | null,
  };

  if (settingsRes.status === "fulfilled") {
    settingsSummary.usageStatisticsEnabled = settingsRes.value.usageStatisticsEnabled;
    settingsSummary.requestLog = settingsRes.value.requestLog;
    settingsSummary.wsAuth = settingsRes.value.wsAuth;
    settingsSummary.loggingToFile = settingsRes.value.loggingToFile;
    settingsSummary.requestRetry = settingsRes.value.requestRetry;
  } else {
    const e = toManagementError(settingsRes.reason);
    partialErrors.push({
      source: "config",
      code: `SETTINGS_${e.code}`,
      message: e.message,
      httpStatus: e.httpStatus,
      retryable: e.retryable,
    });
  }

  const pricingCoverage = {
    configuredModelsCount: null as number | null,
    usedModelsCount: null as number | null,
    missingModelsCount: null as number | null,
    missingModelsTop: null as string[] | null,
  };

  if (pricingRes.status === "fulfilled") {
    pricingCoverage.configuredModelsCount = pricingRes.value.configuredModelsCount;
    pricingCoverage.usedModelsCount = pricingRes.value.usedModelsCount;
    pricingCoverage.missingModelsCount = pricingRes.value.missingModelsCount;
    pricingCoverage.missingModelsTop = pricingRes.value.missingModelsTop;
  } else {
    const message = pricingRes.reason instanceof Error ? pricingRes.reason.message : String(pricingRes.reason);
    partialErrors.push({
      source: "config",
      code: "PRICING_DB_ERROR",
      message,
      retryable: true,
    });
  }

  return {
    configHealth: {
      apiKeysCount,
      providersSummary,
      pricingCoverage,
      settingsSummary,
    },
    partialErrors,
  };
}
