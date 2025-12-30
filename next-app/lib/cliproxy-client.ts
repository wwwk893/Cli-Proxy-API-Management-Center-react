import { fetchManagementJson } from "@/lib/management/client";

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

async function callManagementJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { data } = await fetchManagementJson<T>(path, init);
  return data;
}

export async function fetchUsageRaw() {
  return callManagementJson("/usage");
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
  return callManagementJson(path);
}

export async function clearLogs(): Promise<ClearLogsResponse> {
  return callManagementJson("/logs", { method: "DELETE" });
}

export async function fetchLogsRaw(): Promise<LogsResponse> {
  return callManagementJson("/logs");
}
