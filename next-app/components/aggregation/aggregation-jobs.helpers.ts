import { format } from "date-fns";

import { AggregationJob, JobStatus } from "@/app/pipeline/aggregation/types";

export const STATUS_COLORS: Record<JobStatus, string> = {
  pending: "bg-slate-200 text-slate-900",
  running: "bg-blue-200 text-blue-900",
  completed: "bg-green-200 text-green-900",
  failed: "bg-red-200 text-red-900",
};

export const STATUS_LABELS: Record<JobStatus, string> = {
  pending: "pending",
  running: "running",
  completed: "completed",
  failed: "failed",
};

export const STATUS_FILTER_OPTIONS: (JobStatus | "all")[] = ["all", "pending", "running", "completed", "failed"];

export const formatDurationMs = (ms?: number | null) => {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = Math.round(seconds % 60);
  return `${minutes}m ${rem}s`;
};

export const formatDate = (iso?: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return format(d, "yyyy-MM-dd");
};

export const formatDateTime = (iso?: string | null) => {
  if (!iso) return "-";
  const d = new Date(iso);
  return format(d, "yyyy-MM-dd HH:mm:ss");
};

export const truncateText = (text: string | null, length = 64) => {
  if (!text) return "";
  return text.length > length ? `${text.slice(0, length)}…` : text;
};

export const getDefaultDateInputs = () => {
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const iso = yesterday.toISOString().slice(0, 10);
  return { from: iso, to: iso };
};

export type JobStats = {
  counts: Record<JobStatus, number>;
  successRate: string;
};

export const computeStats = (jobs: AggregationJob[]): JobStats => {
  const counts: Record<JobStatus, number> = { pending: 0, running: 0, completed: 0, failed: 0 };
  jobs.forEach((j) => {
    counts[j.status] += 1;
  });
  const total = jobs.length || 1;
  const successRate = ((counts.completed / total) * 100).toFixed(0);
  return { counts, successRate };
};
