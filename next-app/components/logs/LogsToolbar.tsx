"use client";

import { ChangeEvent } from "react";

import { Download, RefreshCcw, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/components/i18n-context";

export type LogsLevel = "all" | "error" | "warn" | "info" | "debug";

export type LogsFilters = {
  search: string;
  level: LogsLevel;
  limit: number;
};

type LogsToolbarProps = {
  filters: LogsFilters;
  onFiltersChange: (filters: LogsFilters) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  autoRefresh: boolean;
  onToggleAutoRefresh: (value: boolean) => void;
  onDownload: () => void;
  onClear: () => void;
};

export function LogsToolbar({
  filters,
  onFiltersChange,
  onRefresh,
  isRefreshing,
  autoRefresh,
  onToggleAutoRefresh,
  onDownload,
  onClear,
}: LogsToolbarProps) {
  const { t } = useI18n();

  const handleSearch = (event: ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ ...filters, search: event.target.value });
  };

  const handleLevel = (value: LogsLevel) => {
    onFiltersChange({ ...filters, level: value });
  };

  const handleLimit = (value: string) => {
    const parsed = Number(value);
    onFiltersChange({ ...filters, limit: Number.isFinite(parsed) ? parsed : filters.limit });
  };

  const toggleAuto = () => onToggleAutoRefresh(!autoRefresh);

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card/60 px-4 py-3 backdrop-blur">
      <div className="flex items-center gap-2 min-w-[220px]">
        <Input
          placeholder={t("logs.searchPlaceholder")}
          value={filters.search}
          onChange={handleSearch}
          className="h-9"
        />
      </div>

      <Select value={filters.level} onValueChange={(v) => handleLevel(v as LogsLevel)}>
        <SelectTrigger className="h-9 w-[130px]">
          <SelectValue placeholder={t("logs.level.label")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("logs.level.all")}</SelectItem>
          <SelectItem value="error">{t("logs.level.error")}</SelectItem>
          <SelectItem value="warn">{t("logs.level.warn")}</SelectItem>
          <SelectItem value="info">{t("logs.level.info")}</SelectItem>
          <SelectItem value="debug">{t("logs.level.debug")}</SelectItem>
        </SelectContent>
      </Select>

      <Select value={String(filters.limit)} onValueChange={handleLimit}>
        <SelectTrigger className="h-9 w-[110px]">
          <SelectValue placeholder={t("logs.limit")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="500">500</SelectItem>
          <SelectItem value="1000">1000</SelectItem>
          <SelectItem value="2000">2000</SelectItem>
          <SelectItem value="2500">2500</SelectItem>
        </SelectContent>
      </Select>

      <button
        type="button"
        onClick={toggleAuto}
        className={`flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors ${
          autoRefresh
            ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-900 dark:text-emerald-50"
            : "border-border text-muted-foreground hover:text-foreground"
        }`}
      >
        <span className={`inline-block h-2 w-2 rounded-full ${autoRefresh ? "bg-emerald-400" : "bg-muted-foreground"}`} />
        {t("logs.autoRefresh")}
      </button>

      <div className="flex items-center gap-2 ml-auto">
        <Button variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing} className="gap-2">
          <RefreshCcw className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          {t("logs.actions.refresh")}
        </Button>
        <Button variant="outline" size="sm" onClick={onDownload} className="gap-2">
          <Download className="h-4 w-4" />
          {t("logs.actions.download")}
        </Button>
        <Button variant="destructive" size="sm" onClick={onClear} className="gap-2">
          <Trash2 className="h-4 w-4" />
          {t("logs.actions.clear")}
        </Button>
      </div>
    </div>
  );
}
