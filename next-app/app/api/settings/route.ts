import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { fetchManagementJson, fetchManagementRaw, toManagementError } from "@/lib/management/client";
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

async function readConfig(): Promise<Record<string, unknown>> {
  const { data } = await fetchManagementJson<Record<string, unknown>>("/config", { method: "GET" });
  return data;
}

async function putSetting(endpoint: string, value: unknown) {
  await fetchManagementRaw(endpoint, {
    method: "PUT",
    body: JSON.stringify({ value }),
  });
}

async function putQuotaSetting(key: "switch-project" | "switch-preview-model", value: boolean) {
  await putSetting(`/quota-exceeded/${key}`, value);
}

async function putProxyUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    await fetchManagementRaw("/proxy-url", { method: "DELETE" });
    return;
  }
  await putSetting("/proxy-url", trimmed);
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
    const config = await readConfig();
    return NextResponse.json(ok(pickSettings(config)));
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
    const beforeConfig = await readConfig();
    const before = pickSettings(beforeConfig);

    const updates = parsed.data;
    const ops: Array<{
      name: string;
      apply: () => Promise<void>;
      rollback: () => Promise<void>;
    }> = [];

    if (updates.debug !== undefined && updates.debug !== before.debug) {
      ops.push({
        name: "debug",
        apply: () => putSetting("/debug", updates.debug),
        rollback: () => putSetting("/debug", before.debug),
      });
    }

    if (updates.proxyUrl !== undefined && updates.proxyUrl.trim() !== before.proxyUrl) {
      ops.push({
        name: "proxyUrl",
        apply: () => putProxyUrl(updates.proxyUrl),
        rollback: () => putProxyUrl(before.proxyUrl),
      });
    }

    if (updates.requestRetry !== undefined && updates.requestRetry !== before.requestRetry) {
      ops.push({
        name: "requestRetry",
        apply: () => putSetting("/request-retry", updates.requestRetry),
        rollback: () => putSetting("/request-retry", before.requestRetry),
      });
    }

    if (updates.usageStatisticsEnabled !== undefined && updates.usageStatisticsEnabled !== before.usageStatisticsEnabled) {
      ops.push({
        name: "usageStatisticsEnabled",
        apply: () => putSetting("/usage-statistics-enabled", updates.usageStatisticsEnabled),
        rollback: () => putSetting("/usage-statistics-enabled", before.usageStatisticsEnabled),
      });
    }

    if (updates.requestLog !== undefined && updates.requestLog !== before.requestLog) {
      ops.push({
        name: "requestLog",
        apply: () => putSetting("/request-log", updates.requestLog),
        rollback: () => putSetting("/request-log", before.requestLog),
      });
    }

    if (updates.wsAuth !== undefined && updates.wsAuth !== before.wsAuth) {
      ops.push({
        name: "wsAuth",
        apply: () => putSetting("/ws-auth", updates.wsAuth),
        rollback: () => putSetting("/ws-auth", before.wsAuth),
      });
    }

    if (updates.loggingToFile !== undefined && updates.loggingToFile !== before.loggingToFile) {
      ops.push({
        name: "loggingToFile",
        apply: () => putSetting("/logging-to-file", updates.loggingToFile),
        rollback: () => putSetting("/logging-to-file", before.loggingToFile),
      });
    }

    if (updates.quotaSwitchProject !== undefined && updates.quotaSwitchProject !== before.quotaSwitchProject) {
      ops.push({
        name: "quotaSwitchProject",
        apply: () => putQuotaSetting("switch-project", updates.quotaSwitchProject),
        rollback: () => putQuotaSetting("switch-project", before.quotaSwitchProject),
      });
    }

    if (updates.quotaSwitchPreviewModel !== undefined && updates.quotaSwitchPreviewModel !== before.quotaSwitchPreviewModel) {
      ops.push({
        name: "quotaSwitchPreviewModel",
        apply: () => putQuotaSetting("switch-preview-model", updates.quotaSwitchPreviewModel),
        rollback: () => putQuotaSetting("switch-preview-model", before.quotaSwitchPreviewModel),
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

    const afterConfig = await readConfig();
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
