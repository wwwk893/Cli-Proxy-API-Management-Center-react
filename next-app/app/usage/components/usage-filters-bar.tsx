"use client";

import { useMemo } from "react";
import { Calendar as CalendarIcon, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { GranularitySelect } from "@/components/usage/granularity-select";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { useI18n } from "@/components/i18n-context";
import { cn } from "@/lib/utils";
import { useUsageFilters } from "@/lib/usage/usage-filters-context";
import { DateTimeRangePicker } from "@/components/ui/datetime-range-picker";
import { ChannelFilter } from "@/components/usage/channel-filter";

export function UsageFiltersBar() {
  const { t } = useI18n();
  const {
    state: { dateRange, granularity, refreshing },
    actions,
  } = useUsageFilters();

  const dateLabel = useMemo(() => {
    if (!dateRange?.from) return `${t("from")}/${t("to")}`;
    const from = dateRange.from;
    const to = dateRange.to;
    const format = (d: Date) => d.toLocaleString(undefined, { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    if (to) {
      return `${format(from)} → ${format(to)}`;
    }
    return format(from);
  }, [dateRange, t]);

  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 rounded-lg bg-muted/40 px-3 py-2 md:gap-3 md:px-4">
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        <ChannelFilter />
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "h-10 w-full sm:w-[320px] justify-start gap-2 px-3 text-left font-normal shadow-sm",
                "hover:bg-background",
                !dateRange?.from && "text-muted-foreground",
              )}
            >
              <CalendarIcon className="h-4 w-4 opacity-70" />
              <span className="truncate">{dateLabel}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start" sideOffset={8}>
            <DateTimeRangePicker
              value={dateRange}
              onChange={(range) => {
                actions.setPreset(null);
                actions.setDateRange(range ?? undefined);
              }}
              minuteStep={5}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        <GranularitySelect
          from={dateRange?.from ? dateRange.from.toISOString() : ""}
          to={dateRange?.to ? dateRange.to.toISOString() : ""}
          value={granularity}
          onChange={(val) => actions.setGranularity(val)}
        />
      </div>

      <div className="flex items-center gap-1 md:gap-2 md:border-l md:border-border/60 md:pl-3 md:ml-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 text-muted-foreground hover:bg-background hover:text-foreground hover:shadow-sm disabled:opacity-60"
          onClick={actions.refreshWithPreset}
          disabled={refreshing}
          aria-busy={refreshing}
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        </Button>
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </div>
  );
}
