export type JobStatus = "pending" | "running" | "completed" | "failed";

export type AggregationChannel = "cliproxy" | "codex" | "opencode";

export type AggregationFilters = {
  models?: string[];
  channels?: AggregationChannel[];
};

export type AggregationJob = {
  id: string;
  kind: string;
  status: JobStatus;
  rangeFrom: string;
  rangeTo: string;
  filters?: AggregationFilters | null;
  filtersHash?: string | null;
  attempts: number;
  workerId: string | null;
  lockedAt: string | null;
  executionMs: number | null;
  lastError: string | null;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
};

export type JobsResponse = {
  data: AggregationJob[];
  page: number;
  limit: number;
  total: number;
};

export type AggregationMeta = {
  channels: AggregationChannel[];
  models: string[];
  earliestEventTime: string | null;
  earliestUtcDate: string | null;
  yesterdayUtcDate: string;
};
