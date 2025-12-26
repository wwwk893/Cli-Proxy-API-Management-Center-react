import { useMemo, useState } from "react";

import { JobsResponse } from "@/app/pipeline/aggregation/types";

type SelectionResult = {
  selectedIds: Set<string>;
  toggleSelection: (id: string) => void;
  toggleSelectAll: () => void;
  clearSelection: () => void;
};

export function useJobSelection(jobsData: JobsResponse): SelectionResult {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const validJobIds = useMemo(() => new Set(jobsData.data.map((job) => job.id)), [jobsData.data]);

  const validatedSelectedIds = useMemo(() => {
    const next = new Set<string>();
    selectedIds.forEach((id) => {
      if (validJobIds.has(id)) next.add(id);
    });
    return next;
  }, [selectedIds, validJobIds]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds(() => {
      const next = new Set<string>();
      const allSelected = validatedSelectedIds.size === jobsData.data.length && jobsData.data.length > 0;
      if (!allSelected) {
        jobsData.data.forEach((job) => next.add(job.id));
      }
      return allSelected ? new Set<string>() : next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  return { selectedIds: validatedSelectedIds, toggleSelection, toggleSelectAll, clearSelection };
}
