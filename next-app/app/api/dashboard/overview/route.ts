import { NextRequest, NextResponse } from "next/server";

import { parseSearchParams, dashboardOverviewQuerySchema } from "@/lib/api";
import { asAuthError } from "@/lib/auth/errors";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { toManagementError } from "@/lib/management/client";

import { buildActionCenter } from "@/lib/dashboard/overview/action-center";
import { resolveDashboardRange } from "@/lib/dashboard/overview/range";
import { fetchConfigHealth, fetchLogsMeta, fetchSystemHealth } from "@/lib/dashboard/overview/management";
import { queryPipelineHealth } from "@/lib/dashboard/overview/pipeline";
import { queryTopModels } from "@/lib/dashboard/overview/top-models";
import { queryOverviewUsage } from "@/lib/dashboard/overview/usage";

import type {
  DashboardConfigHealth,
  DashboardKpis,
  DashboardOverviewRequest,
  DashboardOverviewResponse,
  DashboardPartialError,
  DashboardPipelineHealth,
  DashboardSystemHealth,
  DashboardTopModelRow,
  DashboardTrendBucket,
} from "@/lib/dashboard/overview/types";

export const dynamic = "force-dynamic";

class TimeoutError extends Error {
  ms: number;

  constructor(ms: number, message?: string) {
    super(message || `Timeout after ${ms}ms`);
    this.name = "TimeoutError";
    this.ms = ms;
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function withAbortTimeout<T>(fn: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError(ms));
    }, ms);
  });

  return Promise.race([fn(controller.signal), timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function toPartialError(source: DashboardPartialError["source"], err: unknown): DashboardPartialError {
  if (err instanceof TimeoutError) {
    return {
      source,
      code: "TIMEOUT",
      message: `Timeout after ${err.ms}ms`,
      retryable: true,
    };
  }

  if (source === "system" || source === "logs") {
    const managementError = toManagementError(err);
    return {
      source,
      code: `MANAGEMENT_${managementError.code}`,
      message: managementError.message,
      httpStatus: managementError.httpStatus,
      retryable: managementError.retryable,
    };
  }

  if (source === "config") {
    const managementError = toManagementError(err);
    const code = managementError.code === "UNKNOWN" ? "CONFIG_ERROR" : `MANAGEMENT_${managementError.code}`;
    return {
      source,
      code,
      message: managementError.message,
      httpStatus: managementError.httpStatus,
      retryable: managementError.retryable ?? true,
    };
  }

  const message = err instanceof Error ? err.message : String(err);

  if (message.includes("delegate missing")) {
    return {
      source,
      code: "PRISMA_DELEGATE_MISSING",
      message,
      httpStatus: 500,
      retryable: false,
    };
  }

  return {
    source,
    code: source === "usage" || source === "topModels" || source === "pipeline" ? "DB_ERROR" : "UNKNOWN",
    message,
    retryable: true,
  };
}

export async function GET(req: NextRequest) {
  let session;
  try {
    session = await requireSession();
  } catch (err) {
    const authError = asAuthError(err);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = parseSearchParams(searchParams, dashboardOverviewQuerySchema);
  if (!parsed.success) {
    return parsed.error;
  }

  const request: DashboardOverviewRequest = {
    timeWindow: parsed.data.timeWindow,
    channel: parsed.data.channel,
  };

  const range = resolveDashboardRange(request.timeWindow);
  const managementConfig = { serverBase: session.serverBase, key: session.adminKey };

  const generatedAt = new Date().toISOString();
  const partialErrors: DashboardPartialError[] = [];

  let kpis: DashboardKpis | null = null;
  let trendBuckets: DashboardTrendBucket[] | null = null;
  let topModels: DashboardTopModelRow[] | null = null;
  let pipeline: DashboardPipelineHealth | null = null;
  let system: DashboardSystemHealth = {
    connected: false,
    managementBase: session.serverBase,
    serverVersion: null,
    serverBuildDate: null,
  };
  let configHealth: DashboardConfigHealth | null = null;
  let logs: DashboardOverviewResponse["logs"] = null;

  const [usageRes, topModelsRes, pipelineRes, systemRes, logsRes, configRes] = await Promise.allSettled([
    withTimeout(queryOverviewUsage(prisma, range, request.channel), 1500),
    withTimeout(queryTopModels(prisma, range, request.channel), 1500),
    withTimeout(queryPipelineHealth(prisma), 800),
    withAbortTimeout((signal) => fetchSystemHealth(managementConfig, { signal }), 800),
    withAbortTimeout((signal) => fetchLogsMeta(managementConfig, { signal }), 800),
    withAbortTimeout(
      (signal) => fetchConfigHealth({ config: managementConfig, prisma, range, channel: request.channel, signal }),
      1500,
    ),
  ]);

  if (usageRes.status === "fulfilled") {
    kpis = usageRes.value.kpis;
    trendBuckets = usageRes.value.trendBuckets;
  } else {
    partialErrors.push(toPartialError("usage", usageRes.reason));
  }

  if (topModelsRes.status === "fulfilled") {
    topModels = topModelsRes.value;
  } else {
    partialErrors.push(toPartialError("topModels", topModelsRes.reason));
  }

  if (pipelineRes.status === "fulfilled") {
    pipeline = pipelineRes.value;
  } else {
    partialErrors.push(toPartialError("pipeline", pipelineRes.reason));
  }

  if (systemRes.status === "fulfilled") {
    system = systemRes.value;
  } else {
    system = {
      connected: false,
      managementBase: session.serverBase,
      serverVersion: null,
      serverBuildDate: null,
    };
    partialErrors.push(toPartialError("system", systemRes.reason));
  }

  if (logsRes.status === "fulfilled") {
    logs = logsRes.value;
  } else {
    logs = null;
    partialErrors.push(toPartialError("logs", logsRes.reason));
  }

  if (configRes.status === "fulfilled") {
    configHealth = configRes.value.configHealth;
    partialErrors.push(...configRes.value.partialErrors);
  } else {
    configHealth = null;
    partialErrors.push(toPartialError("config", configRes.reason));
  }

  const actionCenter = buildActionCenter({
    system,
    pipeline,
    configHealth,
    topModels,
    kpis,
    partialErrors,
  });

  const data: DashboardOverviewResponse = {
    request,
    generatedAt,
    kpis,
    trend: {
      metricDefault: "costUsd",
      buckets: trendBuckets,
    },
    topModels,
    pipeline,
    system,
    configHealth,
    logs,
    actionCenter,
    partialErrors,
  };

  return NextResponse.json({ data });
}
