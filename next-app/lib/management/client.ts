import "server-only";

import { asAuthError } from "@/lib/auth/errors";
import { readManagementEnv } from "@/lib/management/env";
import type { ManagementError, ManagementErrorCode } from "@/lib/management/types";

export class ManagementRequestError extends Error implements ManagementError {
  code: ManagementErrorCode;
  retryable?: boolean;
  httpStatus?: number;
  details?: unknown;

  constructor(error: ManagementError) {
    super(error.message);
    this.name = "ManagementRequestError";
    this.code = error.code;
    this.retryable = error.retryable;
    this.httpStatus = error.httpStatus;
    this.details = error.details;
  }
}

function mapStatusToCode(status: number): { code: ManagementErrorCode; retryable: boolean } {
  if (status === 401 || status === 403) return { code: "UNAUTHORIZED", retryable: false };
  if (status === 404) return { code: "NOT_FOUND", retryable: false };
  if (status === 429) return { code: "RATE_LIMITED", retryable: true };
  if (status >= 400 && status < 500) return { code: "VALIDATION_ERROR", retryable: false };
  if (status >= 500) return { code: "UPSTREAM_ERROR", retryable: true };
  return { code: "UNKNOWN", retryable: false };
}

async function readResponseErrorMessage(res: Response): Promise<string> {
  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = await res.json().catch(() => null);
    if (data && typeof data === "object") {
      const maybeError = (data as any).error;
      const maybeMessage = (data as any).message;
      if (typeof maybeError === "string" && maybeError.trim()) return maybeError;
      if (typeof maybeMessage === "string" && maybeMessage.trim()) return maybeMessage;
    }
  }

  const text = await res.text().catch(() => "");
  if (text && text.trim()) return text.trim();
  return `Management API error: ${res.status} ${res.statusText}`;
}

function normalizePath(path: string) {
  if (!path) return "/";
  if (path.startsWith("/")) return path;
  return `/${path}`;
}

export type ManagementConfig = {
  serverBase: string;
  key: string;
};

function ensureManagementUrlFromServerBase(serverBase: string): string {
  const base = (serverBase || "").trim().replace(/\/+$/g, "");
  if (!base) return "/v0/management";
  if (/\/v0\/management$/i.test(base)) return base;
  return `${base}/v0/management`;
}

async function fetchManagementRawWithUrlAndKey(
  params: { managementUrl: string; managementKey: string },
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const url = `${params.managementUrl}${normalizePath(path)}`;
  const headers = new Headers(init.headers || {});
  headers.set("Authorization", `Bearer ${params.managementKey}`);

  const body = init.body;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  if (!isFormData && body !== undefined && body !== null) {
    const hasContentType = Array.from(headers.keys()).some((k) => k.toLowerCase() === "content-type");
    if (!hasContentType) {
      headers.set("Content-Type", "application/json");
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers,
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ManagementRequestError({
      code: "UPSTREAM_ERROR",
      message: `无法连接 management API：${message}`,
      retryable: true,
    });
  }

  if (!res.ok) {
    const { code, retryable } = mapStatusToCode(res.status);
    const message = await readResponseErrorMessage(res);
    throw new ManagementRequestError({
      code,
      message,
      retryable,
      httpStatus: res.status,
    });
  }

  return res;
}

export function toManagementError(err: unknown): ManagementError {
  if (err instanceof ManagementRequestError) {
    return {
      code: err.code,
      message: err.message,
      retryable: err.retryable,
      httpStatus: err.httpStatus,
      details: err.details,
    };
  }

  const authError = asAuthError(err);
  if (authError) {
    const code: ManagementErrorCode =
      authError.code === "MISCONFIGURED"
        ? "ENV_MISSING"
        : authError.code === "VALIDATION_ERROR"
          ? "VALIDATION_ERROR"
          : "UNAUTHORIZED";

    return {
      code,
      message: authError.message,
      retryable: false,
      httpStatus: authError.status,
      details: authError.details,
    };
  }

  const message = err instanceof Error ? err.message : "Unknown error";
  return {
    code: "UNKNOWN",
    message,
    retryable: false,
  };
}

export async function fetchManagementRaw(path: string, init: RequestInit = {}): Promise<Response> {
  const { managementUrl, managementKey, hasKey } = readManagementEnv();
  if (!hasKey) {
    throw new ManagementRequestError({
      code: "ENV_MISSING",
      message: "服务端未配置 CLIPROXY_MANAGEMENT_KEY",
      retryable: false,
      httpStatus: 500,
    });
  }

  return fetchManagementRawWithUrlAndKey({ managementUrl, managementKey: managementKey || "" }, path, init);
}

export async function fetchManagementRawWithConfig(
  config: ManagementConfig,
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const managementKey = (config.key || "").trim();
  if (!managementKey) {
    throw new ManagementRequestError({
      code: "UNAUTHORIZED",
      message: "缺少管理密钥",
      retryable: false,
      httpStatus: 401,
    });
  }

  const managementUrl = ensureManagementUrlFromServerBase(config.serverBase);
  return fetchManagementRawWithUrlAndKey({ managementUrl, managementKey }, path, init);
}

export async function fetchManagementJsonWithConfig<T>(
  config: ManagementConfig,
  path: string,
  init: RequestInit = {},
): Promise<{ data: T; headers: Headers }> {
  const res = await fetchManagementRawWithConfig(config, path, init);
  const data = (await res.json()) as T;
  return { data, headers: res.headers };
}

export async function fetchManagementTextWithConfig(
  config: ManagementConfig,
  path: string,
  init: RequestInit = {},
): Promise<{ text: string; headers: Headers }> {
  const res = await fetchManagementRawWithConfig(config, path, init);
  const text = await res.text();
  return { text, headers: res.headers };
}

export async function fetchManagementJson<T>(path: string, init: RequestInit = {}): Promise<{ data: T; headers: Headers }> {
  const res = await fetchManagementRaw(path, init);
  const data = (await res.json()) as T;
  return { data, headers: res.headers };
}

export async function fetchManagementText(path: string, init: RequestInit = {}): Promise<{ text: string; headers: Headers }> {
  const res = await fetchManagementRaw(path, init);
  const text = await res.text();
  return { text, headers: res.headers };
}
