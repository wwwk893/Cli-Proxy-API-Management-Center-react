import { AggregationJob, JobStatus } from "@/app/pipeline/aggregation/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { MoreHorizontal } from "lucide-react";
import type { AggregationChannel } from "@/app/pipeline/aggregation/types";

export type JobsTableProps = {
  jobs: AggregationJob[];
  statusLabels: Record<JobStatus, string>;
  statusColors: Record<JobStatus, string>;
  channelLabels: Record<AggregationChannel, string>;
  formatDate: (iso?: string | null) => string;
  formatDurationMs: (ms?: number | null) => string;
  truncateText: (text: string | null, length?: number) => string;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onToggleSelectAll: () => void;
  onRetry: (id: string, force?: boolean) => void;
  onShowDetail: (job: AggregationJob) => void;
  onDelete: (id: string) => void;
  labels: {
    status: string;
    periodUtc: string;
    filters: string;
    model: string;
    channel: string;
    all: string;
    duration: string;
    attempts: string;
    summaryError: string;
    actions: string;
    jobDetails: string;
    retry: string;
    forceRerunExisting: string;
    delete: string;
    deleteConfirm: string;
    noJobs: string;
    noJobsFiltered: string;
  };
  isFiltered: boolean;
};

export function JobsTable({
  jobs,
  statusLabels,
  statusColors,
  channelLabels,
  formatDate,
  formatDurationMs,
  truncateText,
  selectedIds,
  onToggleSelection,
  onToggleSelectAll,
  onRetry,
  onShowDetail,
  onDelete,
  labels,
  isFiltered,
}: JobsTableProps) {
  const formatFilterValues = (values?: string[] | null) => {
    if (!values || values.length === 0) return labels.all;
    const visible = values.slice(0, 2);
    const rest = values.length - visible.length;
    return rest > 0 ? `${visible.join(", ")} +${rest}` : visible.join(", ");
  };

  return (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8">
              <input
                type="checkbox"
                checked={selectedIds.size > 0 && selectedIds.size === jobs.length && jobs.length > 0}
                onChange={onToggleSelectAll}
              />
            </TableHead>
            <TableHead>{labels.status}</TableHead>
            <TableHead>{labels.periodUtc}</TableHead>
            <TableHead>{labels.filters}</TableHead>
            <TableHead>{labels.duration}</TableHead>
            <TableHead>{labels.attempts}</TableHead>
            <TableHead>{labels.summaryError}</TableHead>
            <TableHead className="w-12 text-right">{labels.actions}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {jobs.map((job) => {
            const summaryText = job.summary ?? job.lastError ?? "";
            return (
              <TableRow key={job.id} className={cn(job.status === "running" ? "animate-pulse" : "")}> 
                <TableCell>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(job.id)}
                    onChange={() => onToggleSelection(job.id)}
                  />
                </TableCell>
                <TableCell>
                  <Badge className={cn("capitalize", statusColors[job.status])}>{statusLabels[job.status]}</Badge>
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {formatDate(job.rangeFrom)}
                  {job.rangeTo && job.rangeTo !== job.rangeFrom ? ` → ${formatDate(job.rangeTo)}` : " (Daily)"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  <div className="space-y-1">
                    <div className="truncate">
                      <span className="text-foreground/80">{labels.model}：</span>
                      {formatFilterValues(job.filters?.models ?? null)}
                    </div>
                    <div className="truncate">
                      <span className="text-foreground/80">{labels.channel}：</span>
                      {formatFilterValues(
                        job.filters?.channels?.map((channel) => channelLabels[channel]) ?? null,
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{formatDurationMs(job.executionMs)}</TableCell>
                <TableCell>{job.attempts}</TableCell>
                <TableCell>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="line-clamp-1 text-sm text-muted-foreground">
                          {summaryText ? truncateText(summaryText) : "—"}
                        </span>
                      </TooltipTrigger>
                      {summaryText && (
                        <TooltipContent className="max-w-sm whitespace-pre-wrap text-xs">
                          {summaryText}
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onShowDetail(job)}>{labels.jobDetails}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onRetry(job.id, false)}>{labels.retry}</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onRetry(job.id, true)}>{labels.forceRerunExisting}</DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          if (!window.confirm(labels.deleteConfirm)) return;
                          onDelete(job.id);
                        }}
                      >
                        {labels.delete}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
          {jobs.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-sm text-muted-foreground">
                {isFiltered ? labels.noJobsFiltered : labels.noJobs}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
