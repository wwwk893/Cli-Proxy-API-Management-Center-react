import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { JobsResponse } from "@/app/pipeline/aggregation/types";
import { JobFilters, fetchJobs, hasActiveJobs } from "../aggregation-jobs.api";
import { JobStats, computeStats, getDefaultDateInputs } from "../aggregation-jobs.helpers";

type UseAggregationJobsDataResult = {
  filters: JobFilters;
  setFilters: Dispatch<SetStateAction<JobFilters>>;
  jobsData: JobsResponse;
  setJobsData: Dispatch<SetStateAction<JobsResponse>>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  stats: JobStats;
  defaultDates: { from: string; to: string };
};

export function useAggregationJobsData(initialData: JobsResponse): UseAggregationJobsDataResult {
  const [filters, setFilters] = useState<JobFilters>({ page: initialData.page ?? 1, limit: initialData.limit ?? 20 });
  const [jobsData, setJobsData] = useState<JobsResponse>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultDates = useMemo(() => getDefaultDateInputs(), []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJobs(filters);
      setJobsData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchJobs(filters);
        if (!cancelled) setJobsData(data);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load jobs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filters]);

  useEffect(() => {
    if (!jobsData?.data) return;
    if (!hasActiveJobs(jobsData.data)) return;
    const id = setInterval(async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const data = await fetchJobs(filters);
        setJobsData(data);
      } catch {
        // ignore polling errors
      }
    }, 5000);
    return () => clearInterval(id);
  }, [jobsData?.data, filters]);

  const stats = useMemo<JobStats>(() => computeStats(jobsData?.data ?? []), [jobsData]);

  return {
    filters,
    setFilters,
    jobsData,
    setJobsData,
    loading,
    error,
    refresh: load,
    stats,
    defaultDates,
  };
}
