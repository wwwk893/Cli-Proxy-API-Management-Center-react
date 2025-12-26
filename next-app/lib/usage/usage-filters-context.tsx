"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import type { Granularity } from "@/components/charts/usage/types";
import type { PresetKey } from "./presets";
import type { UsageQueryState } from "./url-state";
import { useUsageParams, type UsageUrlActions } from "./hooks/use-usage-params";

type UsageFiltersContextValue = {
  state: UsageQueryState & { refreshing: boolean };
  actions: UsageUrlActions & { beginRefresh: () => void; endRefresh: () => void };
};

const UsageFiltersContext = createContext<UsageFiltersContextValue | null>(null);

export function UsageFiltersProvider({ children }: { children: React.ReactNode }) {
  const { state, actions } = useUsageParams();
  const [pendingRefreshes, setPendingRefreshes] = useState(0);

  const beginRefresh = useCallback(() => setPendingRefreshes((count) => count + 1), []);
  const endRefresh = useCallback(() => setPendingRefreshes((count) => (count > 0 ? count - 1 : 0)), []);

  const value = useMemo(
    () => ({
      state: { ...state, refreshing: pendingRefreshes > 0 },
      actions: { ...actions, beginRefresh, endRefresh },
    }),
    [actions, beginRefresh, endRefresh, pendingRefreshes, state],
  );
  return <UsageFiltersContext.Provider value={value}>{children}</UsageFiltersContext.Provider>;
}

export function useUsageFilters() {
  const ctx = useContext(UsageFiltersContext);
  if (!ctx) throw new Error("useUsageFilters must be used within UsageFiltersProvider");
  return ctx;
}

// Re-export types for consumers
export type { UsageQueryState, UsageUrlActions, PresetKey, DateRange, Granularity };
