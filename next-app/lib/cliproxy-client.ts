import { serverEnv } from "@/lib/env";

const MANAGEMENT_BASE = serverEnv.CLIPROXY_MANAGEMENT_BASE;
const MANAGEMENT_KEY = serverEnv.CLIPROXY_MANAGEMENT_KEY;

type LogsResponse = {
  lines: string[];
  "latest-timestamp"?: string;
  "line-count"?: number;
};

type ClearLogsResponse = {
  status: string;
  removed?: number;
};

const DEFAULT_LOG_FETCH_LIMIT = 2500;

async function callManagement(path: string, init: RequestInit = {}) {
  if (!MANAGEMENT_KEY) {
    throw new Error("CLIPROXY_MANAGEMENT_KEY is not set");
  }
  try {
    const res = await fetch(`${MANAGEMENT_BASE}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${MANAGEMENT_KEY}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Management API error: ${res.status} ${res.statusText}`);
    }
    return res.json();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to call management API: ${message}`);
  }
}

export async function fetchUsageRaw() {
  return callManagement("/usage");
}

export async function fetchLogs(params: { after?: string; limit?: number }): Promise<LogsResponse> {
  const search = new URLSearchParams();
  if (params.after) {
    search.set("after", params.after);
  }
  const limit = Number.isFinite(params.limit) ? params.limit : DEFAULT_LOG_FETCH_LIMIT;
  if (limit && Number.isFinite(limit)) {
    search.set("limit", String(limit));
  }

  const query = search.toString();
  const path = query ? `/logs?${query}` : "/logs";
  return callManagement(path);
}

export async function clearLogs(): Promise<ClearLogsResponse> {
  return callManagement("/logs", { method: "DELETE" });
}

export async function fetchLogsRaw(): Promise<LogsResponse> {
  return callManagement("/logs");
}
