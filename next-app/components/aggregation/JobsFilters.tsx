import { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RefreshCw } from "lucide-react";

type StatusOption = string;

export type JobsFiltersProps = {
  statusOptions: StatusOption[];
  statusValue: string;
  onStatusChange: (value: string) => void;
  getStatusLabel: (value: string) => string;
  onRefresh: () => void;
  onRunPending: () => void;
  runLoading: boolean;
  runMessage?: string | null;
  runError?: string | null;
  selectedCount: number;
  onBatchRetry: () => void;
  labels: {
    status: string;
    runPending: string;
    retry: string;
    loading: string;
  };
  extra?: ReactNode;
};

export function JobsFilters({
  statusOptions,
  statusValue,
  onStatusChange,
  getStatusLabel,
  onRefresh,
  onRunPending,
  runLoading,
  runMessage,
  runError,
  selectedCount,
  onBatchRetry,
  labels,
  extra,
}: JobsFiltersProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="status-filter" className="text-sm text-muted-foreground">
          {labels.status}
        </Label>
        <select
          id="status-filter"
          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          value={statusValue}
          onChange={(e) => onStatusChange(e.target.value)}
        >
          {statusOptions.map((opt) => (
            <option key={opt} value={opt}>
              {getStatusLabel(opt)}
            </option>
          ))}
        </select>
        <Button variant="ghost" size="icon" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        {extra}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" onClick={onRunPending} disabled={runLoading}>
          {runLoading ? labels.loading : labels.runPending}
        </Button>
        {runMessage && <span className="text-sm text-green-700">{runMessage}</span>}
        {runError && <span className="text-sm text-red-600">{runError}</span>}
        {selectedCount > 0 && (
          <Button variant="secondary" onClick={onBatchRetry}>
            {labels.retry} {selectedCount}
          </Button>
        )}
      </div>
    </div>
  );
}
