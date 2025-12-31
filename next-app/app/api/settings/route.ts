import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOrigin } from "@/lib/auth/guards";
import { requireSession } from "@/lib/auth/session";
import { fetchManagementJsonWithConfig, fetchManagementRawWithConfig, toManagementError } from "@/lib/management/client";
import { fail, ok } from "@/lib/management/types";

type SettingsData = {
  debug: boolean;
  proxyUrl: string;
  requestRetry: number;
  usageStatisticsEnabled: boolean;
  requestLog: boolean;
  wsAuth: boolean;
  loggingToFile: boolean;
  quotaSwitchProject: boolean;
  quotaSwitchPreviewModel: boolean;
};

function asBoolean(value: unknown) {
  return value === true || value === "true" || value === 1 || value === "1";
}

function asNumber(value: unknown, fallback: number) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function pickSettings(config: Record<string, unknown>): SettingsData {
  const quota = (config["quota-exceeded"] && typeof config["quota-exceeded"] === "object")
    ? (config["quota-exceeded"] as Record<string, unknown>)
    : {};

  return {
    debug: asBoolean(config.debug),
    proxyUrl: asString(config["proxy-url"]).trim(),
    requestRetry: asNumber(config["request-retry"], 0),
    usageStatisticsEnabled: asBoolean(config["usage-statistics-enabled"]),
    requestLog: asBoolean(config["request-log"]),
    wsAuth: asBoolean(config["ws-auth"]),
    loggingToFile: asBoolean(config["logging-to-file"]),
    quotaSwitchProject: asBoolean(quota["switch-project"]),
    quotaSwitchPreviewModel: asBoolean(quota["switch-preview-model"]),
  };
}

async function readConfig(config: { serverBase: string; key: string }): Promise<Record<string, unknown>> {
  const { data } = await fetchManagementJsonWithConfig<Record<string, unknown>>(config, "/config", { method: "GET" });
  return data;
}

async function putSetting(config: { serverBase: string; key: string }, endpoint: string, value: unknown) {
  await fetchManagementRawWithConfig(config, endpoint, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
}

async function putQuotaSetting(
  config: { serverBase: string; key: string },
  key: "switch-project" | "switch-preview-model",
  value: boolean,
) {
  await putSetting(config, `/quota-exceeded/${key}`, value);
}

async function putProxyUrl(config: { serverBase: string; key: string }, value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    await fetchManagementRawWithConfig(config, "/proxy-url", { method: "DELETE" });
    return;
  }
  await putSetting(config, "/proxy-url", trimmed);
}

const patchSchema = z
  .object({
    debug: z.boolean().optional(),
    proxyUrl: z.string().optional(),
    requestRetry: z.number().int().min(0).max(50).optional(),
    usageStatisticsEnabled: z.boolean().optional(),
    requestLog: z.boolean().optional(),
    wsAuth: z.boolean().optional(),
    loggingToFile: z.boolean().optional(),
    quotaSwitchProject: z.boolean().optional(),
    quotaSwitchPreviewModel: z.boolean().optional(),
  })
  .strict();

export async function GET() {
  try {
    const session = await requireSession();
    const managementConfig = { serverBase: session.serverBase, key: session.adminKey };

    const rawConfig = await readConfig(managementConfig);
    return NextResponse.json(ok(pickSettings(rawConfig)));
  } catch (err) {
    const managementError = toManagementError(err);
    const status = managementError.httpStatus && managementError.httpStatus >= 400 ? managementError.httpStatus : 500;
    return NextResponse.json(
      fail(managementError.code, managementError.message, {
        retryable: managementError.retryable,
        httpStatus: managementError.httpStatus,
      }),
      { status },
    );
  }
}

export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(fail("VALIDATION_ERROR", "Invalid JSON body"), { status: 400 });
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      fail("VALIDATION_ERROR", "Validation failed", {
        details: parsed.error.flatten(),
      }),
      { status: 400 },
    );
  }

  try {
    assertSameOrigin(req);
    const session = await requireSession();
    const managementConfig = { serverBase: session.serverBase, key: session.adminKey };

    const beforeConfig = await readConfig(managementConfig);
    const before = pickSettings(beforeConfig);

    const updates = parsed.data;
    const ops: Array<{
      name: string;
      apply: () => Promise<void>;
      rollback: () => Promise<void>;
    }> = [];

    if (updates.debug !== undefined && updates.debug !== before.debug) {
      const nextDebug = updates.debug;
      ops.push({
        name: "debug",
        apply: () => putSetting(managementConfig, "/debug", nextDebug),
        rollback: () => putSetting(managementConfig, "/debug", before.debug),
      });
    }

    if (updates.proxyUrl !== undefined && updates.proxyUrl.trim() !== before.proxyUrl) {
      const nextProxyUrl = updates.proxyUrl;
      ops.push({
        name: "proxyUrl",
        apply: () => putProxyUrl(managementConfig, nextProxyUrl),
        rollback: () => putProxyUrl(managementConfig, before.proxyUrl),
      });
    }

    if (updates.requestRetry !== undefined && updates.requestRetry !== before.requestRetry) {
      const nextRequestRetry = updates.requestRetry;
      ops.push({
        name: "requestRetry",
        apply: () => putSetting(managementConfig, "/request-retry", nextRequestRetry),
        rollback: () => putSetting(managementConfig, "/request-retry", before.requestRetry),
      });
    }

    if (updates.usageStatisticsEnabled !== undefined && updates.usageStatisticsEnabled !== before.usageStatisticsEnabled) {
      const nextUsageStatisticsEnabled = updates.usageStatisticsEnabled;
      ops.push({
        name: "usageStatisticsEnabled",
        apply: () => putSetting(managementConfig, "/usage-statistics-enabled", nextUsageStatisticsEnabled),
        rollback: () => putSetting(managementConfig, "/usage-statistics-enabled", before.usageStatisticsEnabled),
      });
    }

    if (updates.requestLog !== undefined && updates.requestLog !== before.requestLog) {
      const nextRequestLog = updates.requestLog;
      ops.push({
        name: "requestLog",
        apply: () => putSetting(managementConfig, "/request-log", nextRequestLog),
        rollback: () => putSetting(managementConfig, "/request-log", before.requestLog),
      });
    }

    if (updates.wsAuth !== undefined && updates.wsAuth !== before.wsAuth) {
      const nextWsAuth = updates.wsAuth;
      ops.push({
        name: "wsAuth",
        apply: () => putSetting(managementConfig, "/ws-auth", nextWsAuth),
        rollback: () => putSetting(managementConfig, "/ws-auth", before.wsAuth),
      });
    }

    if (updates.loggingToFile !== undefined && updates.loggingToFile !== before.loggingToFile) {
      const nextLoggingToFile = updates.loggingToFile;
      ops.push({
        name: "loggingToFile",
        apply: () => putSetting(managementConfig, "/logging-to-file", nextLoggingToFile),
        rollback: () => putSetting(managementConfig, "/logging-to-file", before.loggingToFile),
      });
    }

    if (updates.quotaSwitchProject !== undefined && updates.quotaSwitchProject !== before.quotaSwitchProject) {
      const nextQuotaSwitchProject = updates.quotaSwitchProject;
      ops.push({
        name: "quotaSwitchProject",
        apply: () => putQuotaSetting(managementConfig, "switch-project", nextQuotaSwitchProject),
        rollback: () => putQuotaSetting(managementConfig, "switch-project", before.quotaSwitchProject),
      });
    }

    if (updates.quotaSwitchPreviewModel !== undefined && updates.quotaSwitchPreviewModel !== before.quotaSwitchPreviewModel) {
      const nextQuotaSwitchPreviewModel = updates.quotaSwitchPreviewModel;
      ops.push({
        name: "quotaSwitchPreviewModel",
        apply: () => putQuotaSetting(managementConfig, "switch-preview-model", nextQuotaSwitchPreviewModel),
        rollback: () => putQuotaSetting(managementConfig, "switch-preview-model", before.quotaSwitchPreviewModel),
      });
    }

    if (ops.length === 0) {
      return NextResponse.json(ok(before));
    }

    const applied: Array<{ name: string; rollback: () => Promise<void> }> = [];
    try {
      for (const op of ops) {
        await op.apply();
        applied.push({ name: op.name, rollback: op.rollback });
      }
    } catch (err) {
      for (const prev of applied.reverse()) {
        try {
          await prev.rollback();
        } catch {
          // best effort rollback
        }
      }
      throw err;
    }

    const afterConfig = await readConfig(managementConfig);
    return NextResponse.json(ok(pickSettings(afterConfig)));
  } catch (err) {
    const managementError = toManagementError(err);
    const status = managementError.httpStatus && managementError.httpStatus >= 400 ? managementError.httpStatus : 500;
    return NextResponse.json(
      fail(managementError.code, managementError.message, {
        retryable: managementError.retryable,
        httpStatus: managementError.httpStatus,
      }),
      { status },
    );
  }
}
