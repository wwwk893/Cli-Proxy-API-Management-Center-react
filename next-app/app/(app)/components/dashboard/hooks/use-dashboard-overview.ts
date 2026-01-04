"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { DashboardOverviewRequest, DashboardOverviewResponse } from "@/lib/dashboard/overview/types";

type DashboardOverviewState =
  | { kind: "loading"; filters: DashboardOverviewRequest }
  | { kind: "ready"; filters: DashboardOverviewRequest; data: DashboardOverviewResponse }
  | { kind: "auth-required" }
  | { kind: "error"; filters: DashboardOverviewRequest; message: string; httpStatus?: number; canRetry: boolean };

type DashboardOverviewResult = {
  state: DashboardOverviewState;
  refreshing: boolean;
  refresh: () => void;
};

function buildDashboardOverviewUrl(filters: DashboardOverviewRequest): string {
  const params = new URLSearchParams();
  params.set("timeWindow", filters.timeWindow);
  params.set("channel", filters.channel);
  return `/api/dashboard/overview?${params.toString()}`;
}

export function useDashboardOverview(filters: DashboardOverviewRequest): DashboardOverviewResult {
  const requestSeqRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const [state, setState] = useState<DashboardOverviewState>(() => ({ kind: "loading", filters }));
  const [refreshing, setRefreshing] = useState(false);

  const runFetch = useCallback(
    async ({ keepData }: { keepData: boolean }) => {
      requestSeqRef.current += 1;
      const seq = requestSeqRef.current;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      if (!keepData) {
        setRefreshing(false);
        setState({ kind: "loading", filters });
      } else {
        setRefreshing(true);
      }

      try {
        const res = await fetch(buildDashboardOverviewUrl(filters), {
          method: "GET",
          headers: {
            accept: "application/json",
          },
          signal: controller.signal,
        });

        if (seq !== requestSeqRef.current) return;

        if (res.status === 401 || res.status === 403) {
          setRefreshing(false);
          setState({ kind: "auth-required" });
          return;
        }

        const json = (await res.json().catch(() => null)) as { data?: DashboardOverviewResponse; error?: string } | null;

        if (!res.ok) {
          const message = json?.error || res.statusText || "Request failed";
          setRefreshing(false);
          setState({ kind: "error", filters, message, httpStatus: res.status, canRetry: true });
          return;
        }

        if (!json?.data) {
          setRefreshing(false);
          setState({ kind: "error", filters, message: "Malformed response", httpStatus: res.status, canRetry: true });
          return;
        }

        setRefreshing(false);
        setState({ kind: "ready", filters, data: json.data });
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        if (seq !== requestSeqRef.current) return;

        const message = err instanceof Error ? err.message : "Request failed";
        setRefreshing(false);
        setState({ kind: "error", filters, message, canRetry: true });
      }
    },
    [filters],
  );

  useEffect(() => {
    void runFetch({ keepData: false });

    return () => {
      abortRef.current?.abort();
    };
  }, [runFetch]);

  const refresh = useCallback(() => {
    if (state.kind === "auth-required") return;
    void runFetch({ keepData: true });
  }, [runFetch, state.kind]);

  return { state, refreshing, refresh };
}
