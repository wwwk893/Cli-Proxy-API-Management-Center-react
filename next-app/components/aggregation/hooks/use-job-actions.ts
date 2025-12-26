import React, { useState } from "react";

import { JobFilters, batchRetryJobs, createJob, deleteJob, fetchJobs, retryJob, runPendingJobs } from "../aggregation-jobs.api";
import { AggregationFilters, JobsResponse } from "@/app/pipeline/aggregation/types";

type UseJobActionsParams = {
  filters: JobFilters;
  setJobsData: React.Dispatch<React.SetStateAction<JobsResponse>>;
  clearSelection: () => void;
  formatProcessedMessage?: (count: number) => string;
};

type CreateJobInput = { from: string; to: string; force?: boolean; filters?: AggregationFilters };

export function useJobActions({ filters, setJobsData, clearSelection, formatProcessedMessage }: UseJobActionsParams) {
  const [runLoading, setRunLoading] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const refresh = async () => {
    const data = await fetchJobs(filters);
    setJobsData(data);
  };

  const handleRetry = async (id: string, force = false) => {
    await retryJob(id, force);
    await refresh();
  };

  const handleBatchRetry = async (ids: string[], force = false) => {
    if (ids.length === 0) return;
    await batchRetryJobs(ids, force);
    await refresh();
    clearSelection();
  };

  const handleRunPending = async (limit = 20) => {
    setRunLoading(true);
    setRunMessage(null);
    setRunError(null);
    try {
      const body = await runPendingJobs(limit);
      setRunMessage(formatProcessedMessage ? formatProcessedMessage(body.processed ?? 0) : `Processed jobs: ${body.processed ?? 0}`);
      await refresh();
    } catch (err) {
      setRunError(err instanceof Error ? err.message : "Failed to run jobs");
    } finally {
      setRunLoading(false);
    }
  };

  const handleCreateJob = async ({ from, to, force, filters }: CreateJobInput) => {
    await createJob({ from, to, force, filters });
    await refresh();
  };

  const handleDeleteJob = async (id: string) => {
    await deleteJob(id);
    await refresh();
    clearSelection();
  };

  return {
    handleRetry,
    handleBatchRetry,
    handleRunPending,
    handleCreateJob,
    handleDeleteJob,
    runLoading,
    runMessage,
    runError,
    setRunMessage,
    setRunError,
  };
}
