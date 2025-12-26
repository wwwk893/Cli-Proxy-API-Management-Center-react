"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { LogsEmptyState } from "@/components/logs/LogsEmptyState";
import { LogsErrorState } from "@/components/logs/LogsErrorState";
import { LogsStatsBar } from "@/components/logs/LogsStatsBar";
import { LogsViewer } from "@/components/logs/LogsViewer";
import { LogsFilters, LogsLevel, LogsToolbar } from "@/components/logs/LogsToolbar";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/components/i18n-context";

type LogsResponse = {
  lines: string[];
  "latest-timestamp"?: string;
  "line-count"?: number;
};

export type LogsInitialData = LogsResponse | null;
export type LogsInitialFilters = {
  search: string;
  level: LogsLevel;
  limit: number;
};

const MAX_DISPLAY_LOG_LINES = 2000;

type LogsClientProps = {
  initialData: LogsInitialData;
  initialFilters: LogsInitialFilters;
};

function filterLines(lines: string[], filters: LogsFilters) {
  const { search, level } = filters;
  const loweredSearch = search.trim().toLowerCase();

  return lines.filter((line) => {
    if (loweredSearch && !line.toLowerCase().includes(loweredSearch)) {
      return false;
    }

    if (level === "all") return true;

    const levelPatterns: Record<LogsLevel, RegExp> = {
      all: /.*/,
      error: /\[(ERROR|ERRO|ERR|FATAL|CRITICAL|CRIT|PANIC)\]/i,
      warn: /\[(WARN|WARNING)\]/i,
      info: /\[INFO\]/i,
      debug: /\[(DEBUG|TRACE)\]/i,
    };

    const matcher = levelPatterns[level];
    return matcher.test(line);
  });
}

function isNearBottom(container: HTMLDivElement | null) {
  if (!container) return true;
  const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
  return distance < 80;
}

function scrollToBottom(container: HTMLDivElement | null) {
  if (!container) return;
  container.scrollTop = container.scrollHeight;
}

export default function LogsClient({ initialData, initialFilters }: LogsClientProps) {
  const [lines, setLines] = useState<string[]>(() => {
    const filtered = initialData?.lines?.filter((l) => !l.includes("/v0/management/")) || [];
    return filtered.slice(-MAX_DISPLAY_LOG_LINES);
  });
  const [latestTimestamp, setLatestTimestamp] = useState<string | null>(initialData?.["latest-timestamp"] || null);
  const [totalCount, setTotalCount] = useState<number>(initialData?.["line-count"] ?? lines.length);
  const [isLoading, setIsLoading] = useState<boolean>(!initialData);
  const [isIncrementalLoading, setIsIncrementalLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<LogsFilters>(initialFilters);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(initialData ? new Date() : null);
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  const { t } = useI18n();

  const containerRef = useRef<HTMLDivElement>(null);

  const displayedLines = useMemo(() => filterLines(lines, filters), [lines, filters]);

  const fetchLogsApi = useCallback(
    async (incremental: boolean) => {
      const params = new URLSearchParams();
      if (incremental && latestTimestamp) {
        params.set("after", latestTimestamp);
      }
      if (filters.limit) {
        params.set("limit", String(filters.limit));
      }

      const query = params.toString();
      const url = query ? `/api/logs?${query}` : "/api/logs";

      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Failed to fetch logs: ${res.status}`);
      }

      const data = (await res.json()) as LogsResponse;
      const fetchedLines = data.lines?.filter((l) => !l.includes("/v0/management/")) || [];

      setLines((prev) => {
        const combined = incremental ? [...prev, ...fetchedLines] : fetchedLines;
        return combined.slice(Math.max(0, combined.length - MAX_DISPLAY_LOG_LINES));
      });

      setLatestTimestamp(data["latest-timestamp"] ?? (incremental ? latestTimestamp : null));
      setTotalCount(data["line-count"] ?? fetchedLines.length);
      setLastUpdatedAt(new Date());
      setError(null);

      const stickToBottom = isNearBottom(containerRef.current);
      if (stickToBottom) {
        requestAnimationFrame(() => scrollToBottom(containerRef.current));
      }
    },
    [filters.limit, latestTimestamp],
  );

  const loadLogs = useCallback(
    async (incremental: boolean) => {
      if (incremental && !latestTimestamp) {
        incremental = false;
      }
      if (incremental) {
        setIsIncrementalLoading(true);
      } else {
        setIsLoading(true);
      }
      try {
        await fetchLogsApi(incremental);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        setError(message);
      } finally {
        if (incremental) {
          setIsIncrementalLoading(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [fetchLogsApi, latestTimestamp],
  );

  useEffect(() => {
    if (!initialData) {
      loadLogs(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const id = autoRefresh
      ? setInterval(() => {
          if (document.visibilityState === "visible") {
            loadLogs(true);
          }
        }, 5000)
      : null;
    return () => {
      if (id) clearInterval(id);
    };
  }, [autoRefresh, loadLogs]);

  const handleFiltersChange = (next: LogsFilters) => {
    const limitChanged = next.limit !== filters.limit;
    setFilters(next);
    if (limitChanged) {
      loadLogs(false);
    }
  };

  const handleRefresh = () => loadLogs(false);

  const handleDownload = () => {
    window.open("/api/logs/download", "_blank");
  };

  const handleClear = async () => {
    const confirmed = window.confirm(t("logs.clear.confirm"));
    if (!confirmed) return;
    try {
      const res = await fetch("/api/logs", { method: "DELETE" });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to clear logs");
      }
      setLines([]);
      setLatestTimestamp(null);
      setTotalCount(0);
      setLastUpdatedAt(new Date());
      setError(null);
      loadLogs(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("logs.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("logs.subtitle")}</p>
        </div>
      </div>

      <Card className="flex flex-col gap-3 border-border/60 bg-card/60 p-4">
        <LogsToolbar
          filters={filters}
          onFiltersChange={handleFiltersChange}
          onRefresh={handleRefresh}
          isRefreshing={isLoading || isIncrementalLoading}
          autoRefresh={autoRefresh}
          onToggleAutoRefresh={setAutoRefresh}
          onDownload={handleDownload}
          onClear={handleClear}
        />

        <LogsStatsBar
          displayedCount={displayedLines.length}
          totalCount={totalCount}
          lastUpdated={lastUpdatedAt}
          filters={filters}
        />

        {error ? (
          <LogsErrorState message={error} onRetry={() => loadLogs(false)} />
        ) : !isLoading && displayedLines.length === 0 ? (
          <LogsEmptyState />
        ) : (
          <LogsViewer
            lines={displayedLines}
            isLoading={isLoading}
            isIncrementalLoading={isIncrementalLoading}
            containerRef={containerRef}
          />
        )}
      </Card>
    </div>
  );
}
