"use client";

import { useMemo, useState } from "react";

import { AggregationFilters, AggregationJob, JobStatus, JobsResponse } from "./types";
import { CreateJobDialog } from "@/components/aggregation/CreateJobDialog";
import { backfillCost } from "@/components/aggregation/aggregation-jobs.api";
import { JobDetailsDialog } from "@/components/aggregation/JobDetailsDialog";
import { JobsFilters } from "@/components/aggregation/JobsFilters";
import { JobsTable } from "@/components/aggregation/JobsTable";
import { StatsCards } from "@/components/aggregation/StatsCards";
import {
  STATUS_COLORS,
  STATUS_FILTER_OPTIONS,
  STATUS_LABELS,
  formatDate,
  formatDateTime,
  formatDurationMs,
  truncateText,
} from "@/components/aggregation/aggregation-jobs.helpers";
import { useAggregationJobsData } from "@/components/aggregation/hooks/use-aggregation-jobs-data";
import { useJobActions } from "@/components/aggregation/hooks/use-job-actions";
import { useJobSelection } from "@/components/aggregation/hooks/use-job-selection";
import { useI18n } from "@/components/i18n-context";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  initialData: JobsResponse;
};

export default function JobsView({ initialData }: Props) {
  const { t } = useI18n();

  const { filters, setFilters, jobsData, setJobsData, loading, error, refresh, stats, defaultDates } =
    useAggregationJobsData(initialData);

  const selection = useJobSelection(jobsData);

  const {
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
  } = useJobActions({
    filters,
    setJobsData,
    clearSelection: selection.clearSelection,
    formatProcessedMessage: (count) => `${t("processedJobs")}: ${count}`,
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [backfillOpen, setBackfillOpen] = useState(false);
  const [backfillError, setBackfillError] = useState<string | null>(null);
  const [backfillLoading, setBackfillLoading] = useState(false);
  const [detailJob, setDetailJob] = useState<AggregationJob | null>(null);

  const statusLabels = useMemo(
    () => ({
      pending: t("pending"),
      running: t("running"),
      completed: t("completed"),
      failed: t("failed"),
    }),
    [t],
  );

  const channelLabels = useMemo(
    () => ({
      cliproxy: t("cliproxyGateway"),
      codex: t("codexCli"),
    }),
    [t],
  );

  const filterLabels = {
    status: t("status"),
    runPending: t("runPendingJobs"),
    retry: t("retry"),
    loading: t("loading"),
  };

  const tableLabels = {
    status: t("status"),
    periodUtc: t("periodUtc"),
    filters: t("filters"),
    model: t("model"),
    channel: t("channel"),
    all: t("all"),
    duration: t("duration"),
    attempts: t("attempts"),
    summaryError: t("summaryError"),
    actions: t("actions"),
    jobDetails: t("jobDetails"),
    retry: t("retry"),
    forceRerunExisting: t("forceRerunExisting"),
    delete: t("delete"),
    deleteConfirm: t("deleteConfirm"),
    noJobs: t("noJobs"),
    noJobsFiltered: t("noJobsFiltered"),
  };

  const detailLabels = {
    jobDetails: t("jobDetails"),
    status: t("status"),
    periodUtc: t("periodUtc"),
    attempts: t("attempts"),
    duration: t("duration"),
    worker: t("worker"),
    locked: t("locked"),
    summary: t("summary"),
    error: t("error"),
    cancel: t("cancel"),
    copyError: t("copyError"),
  };


  const statsLabels = {
    successRate: t("successRate"),
    pendingRunning: t("pendingRunning"),
    failed: t("failed"),
  };

  const handleStatusChange = (value: string) => {
    setFilters((prev) => ({ ...prev, status: value as JobStatus | "all", page: 1 }));
  };

  const handleRefresh = () => {
    setRunMessage(null);
    setRunError(null);
    refresh();
  };

  const handleCreate = async ({
    from,
    to,
    force,
    filters,
  }: {
    from: string;
    to: string;
    force: boolean;
    filters?: AggregationFilters;
  }) => {
    await handleCreateJob({ from, to, force, filters });
    setCreateOpen(false);
  };

  const handleDelete = async (id: string) => {
    try {
      await handleDeleteJob(id);
    } catch (err) {
      setRunError(err instanceof Error ? err.message : t("deleteJobFailed"));
    }
  };

  const handleBackfillToday = async () => {
    setBackfillLoading(true);
    setBackfillError(null);
    try {
      const result = await backfillCost();
      setRunError(null);
      setRunMessage(`${t("backfillCostSuccess")}: ${result.updatedEvents ?? 0}`);
      await refresh();
      setBackfillOpen(false);
    } catch (err) {
      setBackfillError(err instanceof Error ? err.message : t("backfillCostFailed"));
    } finally {
      setBackfillLoading(false);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{t("aggregationPipeline")}</h1>
          <p className="text-sm text-muted-foreground">{t("aggregationSubtitle")}</p>
        </div>
      </div>

      <StatsCards
        successRate={stats.successRate}
        pendingRunning={stats.counts.pending + stats.counts.running}
        failed={stats.counts.failed}
        labels={statsLabels}
      />

      <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-muted-foreground">{t("backfillTodayBanner")}</div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={() => setBackfillOpen(true)}>
            {t("backfillCost")}
          </Button>
          <Button onClick={() => setCreateOpen(true)}>{t("triggerAggregation")}</Button>
        </div>
      </div>

      <JobsFilters
        statusOptions={STATUS_FILTER_OPTIONS}
        statusValue={filters.status ?? "all"}
        onStatusChange={handleStatusChange}
        getStatusLabel={(value) => (value === "all" ? t("all") : t(STATUS_LABELS[value as JobStatus]))}
        onRefresh={handleRefresh}
        onRunPending={() => handleRunPending(20)}
        runLoading={runLoading}
        runMessage={runMessage}
        runError={runError}
        selectedCount={selection.selectedIds.size}
        onBatchRetry={() => handleBatchRetry(Array.from(selection.selectedIds), false)}
        labels={filterLabels}
      />

      {error && <div className="text-sm text-red-600">{t("failedToLoadJobs")}</div>}

      <JobsTable
        jobs={jobsData.data}
        statusLabels={{
          pending: statusLabels.pending,
          running: statusLabels.running,
          completed: statusLabels.completed,
          failed: statusLabels.failed,
        }}
        statusColors={STATUS_COLORS}
        channelLabels={channelLabels}
        formatDate={formatDate}
        formatDurationMs={formatDurationMs}
        truncateText={truncateText}
        selectedIds={selection.selectedIds}
        onToggleSelection={selection.toggleSelection}
        onToggleSelectAll={selection.toggleSelectAll}
        onRetry={handleRetry}
        onShowDetail={setDetailJob}
        onDelete={handleDelete}
        labels={tableLabels}
        isFiltered={Boolean(filters.status && filters.status !== "all")}
      />

      {loading && <div className="text-sm text-muted-foreground">{t("loading")}</div>}

      <JobDetailsDialog
        job={detailJob}
        open={Boolean(detailJob)}
        onOpenChange={(open) => !open && setDetailJob(null)}
        statusLabels={statusLabels}
        formatDate={formatDate}
        formatDateTime={formatDateTime}
        formatDurationMs={formatDurationMs}
        onCopyError={copyText}
        labels={detailLabels}
      />

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <CreateJobDialog
          open={createOpen}
          defaultFrom={defaultDates.from}
          defaultTo={defaultDates.to}
          error={createError}
          onError={setCreateError}
          onCreated={handleCreate}
          onCancel={() => setCreateOpen(false)}
        />
      </Dialog>

      <Dialog
        open={backfillOpen}
        onOpenChange={(open) => {
          setBackfillOpen(open);
          if (!open) setBackfillError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("backfillCost")}</DialogTitle>
            <DialogDescription>{t("backfillTodayTitle")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md border border-border bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              {t("backfillCostHint")}
            </div>
            {backfillError && <p className="text-sm text-destructive">{backfillError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBackfillOpen(false)} disabled={backfillLoading}>
              {t("cancel")}
            </Button>
            <Button onClick={handleBackfillToday} disabled={backfillLoading}>
              {backfillLoading ? t("backfillLoading") : t("backfillCost")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
