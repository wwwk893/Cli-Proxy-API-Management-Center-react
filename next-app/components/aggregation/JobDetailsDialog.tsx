import { AggregationJob, JobStatus } from "@/app/pipeline/aggregation/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Copy } from "lucide-react";

export type JobDetailsDialogProps = {
  job: AggregationJob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  statusLabels: Record<JobStatus, string>;
  formatDate: (iso?: string | null) => string;
  formatDateTime: (iso?: string | null) => string;
  formatDurationMs: (ms?: number | null) => string;
  onCopyError: (text: string) => Promise<void> | void;
  labels: {
    jobDetails: string;
    status: string;
    periodUtc: string;
    attempts: string;
    duration: string;
    worker: string;
    locked: string;
    summary: string;
    error: string;
    cancel: string;
    copyError: string;
  };
};

export function JobDetailsDialog({
  job,
  open,
  onOpenChange,
  statusLabels,
  formatDate,
  formatDateTime,
  formatDurationMs,
  onCopyError,
  labels,
}: JobDetailsDialogProps) {
  if (!job) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{labels.jobDetails}</DialogTitle>
          <DialogDescription className="font-mono text-xs break-all">{job.id}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between"><span>{labels.status}</span><span className="font-medium">{statusLabels[job.status]}</span></div>
          <div className="flex justify-between"><span>{labels.periodUtc}</span><span className="font-mono">{formatDate(job.rangeFrom)}{job.rangeTo && job.rangeTo !== job.rangeFrom ? ` → ${formatDate(job.rangeTo)}` : " (Daily)"}</span></div>
          <div className="flex justify-between"><span>{labels.attempts}</span><span>{job.attempts}</span></div>
          <div className="flex justify-between"><span>{labels.duration}</span><span>{formatDurationMs(job.executionMs)}</span></div>
          <div className="flex justify-between"><span>{labels.worker}</span><span className="font-mono text-xs">{job.workerId ?? "-"}</span></div>
          <div className="flex justify-between"><span>{labels.locked}</span><span className="font-mono text-xs">{job.lockedAt ? formatDateTime(job.lockedAt) : "-"}</span></div>
          <div className="space-y-1">
            <div className="text-sm font-medium">{labels.summary}</div>
            <div className="min-h-[80px] rounded border border-border bg-muted/30 p-2 text-sm">
              {job.summary ?? ""}
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-red-600">{labels.error}</div>
              {job.lastError && (
                <Button variant="ghost" size="icon" onClick={() => onCopyError(job.lastError ?? "")}
                  title={labels.copyError}>
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </div>
            <pre className="min-h-[120px] whitespace-pre-wrap rounded border border-border bg-muted/30 p-2 text-xs font-mono">
              {job.lastError ?? ""}
            </pre>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {labels.cancel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
