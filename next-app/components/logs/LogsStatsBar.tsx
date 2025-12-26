"use client";

import { LogsFilters } from "./LogsToolbar";
import { useI18n } from "@/components/i18n-context";

type LogsStatsBarProps = {
  displayedCount: number;
  totalCount: number;
  lastUpdated: Date | null;
  filters: LogsFilters;
};

export function LogsStatsBar({ displayedCount, totalCount, lastUpdated, filters }: LogsStatsBarProps) {
  const { t } = useI18n();
  const updatedText = lastUpdated ? lastUpdated.toLocaleTimeString() : "--";
  const filtersText = [`${t("logs.stats.level")}: ${filters.level}`, filters.search ? `${t("logs.stats.search")}: "${filters.search}"` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex items-center justify-between text-[11px] text-muted-foreground px-2 py-1 border rounded-md border-slate-800/60 bg-black/40">
      <div className="flex items-center gap-3">
        <span className="flex items-center gap-1 text-emerald-300">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
          {displayedCount.toLocaleString()} {t("logs.stats.lines")}
        </span>
        <span>
          {t("logs.stats.fetched")}: {totalCount.toLocaleString()} {t("logs.stats.lines")}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <span>
          {t("logs.stats.lastUpdated")} {updatedText}
        </span>
        {filtersText ? <span className="truncate max-w-[240px]">{filtersText}</span> : null}
      </div>
    </div>
  );
}
