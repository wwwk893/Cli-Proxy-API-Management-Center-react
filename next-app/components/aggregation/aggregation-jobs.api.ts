import { AggregationFilters, AggregationJob, AggregationMeta, JobStatus, JobsResponse } from "@/app/pipeline/aggregation/types";

export type JobFilters = {
  status?: JobStatus | "all";
  page: number;
  limit: number;
};

export async function fetchJobs(filters: JobFilters): Promise<JobsResponse> {
  const params = new URLSearchParams();
  params.set("page", String(filters.page));
  params.set("limit", String(filters.limit));
  if (filters.status && filters.status !== "all") {
    params.set("status", filters.status);
  }

  const res = await fetch(`/api/usage/aggregate/jobs?${params.toString()}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error("Failed to load jobs");
  }
  return res.json();
}

export async function createJob(payload: { from?: string; to?: string; force?: boolean; kind?: string; filters?: AggregationFilters }) {
  const res = await fetch(`/api/usage/aggregate/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "daily", ...payload }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Failed to create job");
  }
  return res.json();
}

export async function backfillCost() {
  const res = await fetch(`/api/usage/aggregate/backfill-cost`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error ?? "Failed to backfill cost");
  }
  return body as { updatedEvents: number; rangeFrom?: string; rangeTo?: string };
}

export async function fetchAggregationMeta(): Promise<AggregationMeta> {
  const res = await fetch(`/api/usage/aggregate/meta`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Failed to load aggregation metadata");
  }
  return res.json();
}

export async function fetchAggregationEarliest(filters?: AggregationFilters) {
  const res = await fetch(`/api/usage/aggregate/earliest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filters }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error ?? "Failed to load earliest data point");
  }
  return body as { earliestEventTime: string | null; earliestUtcDate: string | null };
}

export async function retryJob(id: string, force?: boolean) {
  const res = await fetch(`/api/usage/aggregate/jobs/${id}/retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Failed to retry job");
  }
  return res.json();
}

export async function batchRetryJobs(ids: string[], force?: boolean) {
  const res = await fetch(`/api/usage/aggregate/jobs/batch-retry`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jobIds: ids, force }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error ?? "Failed to batch retry jobs");
  }
  return res.json();
}

export async function runPendingJobs(limit: number) {
  const res = await fetch(`/api/usage/aggregate/jobs/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ limit }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error ?? "Failed to run jobs");
  }
  return body as { processed: number; errors?: { jobId: string; error: string }[] };
}

export async function deleteJob(id: string) {
  const res = await fetch(`/api/usage/aggregate/jobs/${id}`, { method: "DELETE" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body?.error ?? "Failed to delete job");
  }
  return body as { deleted: boolean };
}

export function hasActiveJobs(jobs: AggregationJob[]) {
  return jobs.some((j) => j.status === "running" || j.status === "pending");
}
