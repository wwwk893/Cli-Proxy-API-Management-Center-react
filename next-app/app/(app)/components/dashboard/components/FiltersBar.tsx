import { RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { DASHBOARD_CHANNELS, DASHBOARD_TIME_WINDOWS } from "../utils/filters";

import type { DashboardChannel, DashboardTimeWindow } from "@/lib/dashboard/overview/types";
import type { DashboardFilters } from "../utils/filters";

function timeWindowLabel(t: (key: string) => string, value: DashboardTimeWindow): string {
  switch (value) {
    case "utc-today":
      return t("dashboard.filters.timeWindow.utcToday");
    case "last-24h":
      return t("dashboard.filters.timeWindow.last24h");
    case "last-7d":
      return t("dashboard.filters.timeWindow.last7d");
    case "last-30d":
      return t("dashboard.filters.timeWindow.last30d");
  }
}

function channelLabel(t: (key: string) => string, value: DashboardChannel): string {
  switch (value) {
    case "all":
      return t("dashboard.filters.channel.all");
    case "cliproxy":
      return t("dashboard.filters.channel.cliproxy");
    case "codex":
      return t("dashboard.filters.channel.codex");
  }
}

export function FiltersBar({
  t,
  filters,
  setFilters,
  stateKind,
  refreshing,
  refresh,
  updatedAge,
  latestEventAge,
  hasPartialErrors,
  partialErrorsCount,
}: {
  t: (key: string) => string;
  filters: DashboardFilters;
  setFilters: (next: Partial<DashboardFilters>) => void;
  stateKind: "loading" | "ready" | "auth-required" | "error";
  refreshing: boolean;
  refresh: () => void;
  updatedAge: string;
  latestEventAge: string;
  hasPartialErrors: boolean;
  partialErrorsCount: number;
}) {
  const selectsDisabled = stateKind === "auth-required";

  return (
    <div className="flex w-full flex-wrap items-center justify-end gap-2 rounded-lg bg-muted/40 px-3 py-2 md:w-auto md:px-4">
      <Select
        value={filters.timeWindow}
        onValueChange={(val) => setFilters({ timeWindow: val as DashboardTimeWindow })}
        disabled={selectsDisabled}
      >
        <SelectTrigger className="h-9 min-w-[140px] bg-background focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          <SelectValue placeholder={t("dashboard.filters.timeWindow.label")} />
        </SelectTrigger>
        <SelectContent align="start">
          {DASHBOARD_TIME_WINDOWS.map((tw) => (
            <SelectItem key={tw} value={tw}>
              {timeWindowLabel(t, tw)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.channel} onValueChange={(val) => setFilters({ channel: val as DashboardChannel })} disabled={selectsDisabled}>
        <SelectTrigger className="h-9 min-w-[140px] bg-background focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-background">
          <SelectValue placeholder={t("dashboard.filters.channel.label")} />
        </SelectTrigger>
        <SelectContent align="start">
          {DASHBOARD_CHANNELS.map((ch) => (
            <SelectItem key={ch} value={ch}>
              {channelLabel(t, ch)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex flex-wrap items-center gap-2 md:hidden">
        <Badge variant="outline" className="bg-background">
          {t("dashboard.freshness.updated")}: {stateKind === "ready" ? `${updatedAge}` : "—"}
        </Badge>
        {hasPartialErrors ? (
          <Badge variant="secondary" className="bg-background">
            {t("dashboard.partialErrors.badge")} ({partialErrorsCount})
          </Badge>
        ) : null}
      </div>

      <div className="hidden items-center gap-2 md:flex">
        <Badge variant="outline" className="bg-background">
          {t("dashboard.freshness.updated")}: {stateKind === "ready" ? `${updatedAge}` : "—"}
        </Badge>
        <Badge variant="outline" className="bg-background">
          {t("dashboard.freshness.latestEvent")}: {stateKind === "ready" ? `${latestEventAge}` : "—"}
        </Badge>
        {hasPartialErrors ? (
          <Badge variant="secondary" className="bg-background">
            {t("dashboard.partialErrors.badge")} ({partialErrorsCount})
          </Badge>
        ) : null}
      </div>

      <Button
        variant={refreshing ? "secondary" : "ghost"}
        size="icon-sm"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-background hover:text-foreground hover:shadow-sm disabled:opacity-60"
        onClick={refresh}
        disabled={refreshing || stateKind === "auth-required"}
        aria-busy={refreshing}
        aria-label={t("refresh")}
        title={t("refresh")}
      >
        <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
      </Button>
    </div>
  );
}
