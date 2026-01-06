'use client';

import { useEffect, useMemo, useState } from "react";
import { Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n-context";
import { Tooltip as UiTooltip, TooltipContent as UiTooltipContent, TooltipTrigger as UiTooltipTrigger } from "@/components/ui/tooltip";
import type { Granularity } from "@/components/usage/granularity-select";
import { useUsageFilters } from "@/lib/usage/usage-filters-context";
import { buildTableModel } from "@/components/charts/usage-model-table/build-table-model";
import { EffortFilter } from "@/components/charts/usage-model-table/effort-filter";
import { RawWarningBanner } from "@/components/charts/usage-model-table/raw-warning-banner";
import { ViewModeToggle } from "@/components/charts/usage-model-table/view-mode-toggle";
import { normalizeModel } from "@/lib/usage/model-normalize";
import type { UsageByModelRow } from "@/app/api/usage/by-model/types";
import type { TableViewModel } from "@/components/charts/usage-model-table/types";
import { UsageModelTableRows } from "@/components/charts/usage-model-table/rows";

type Props = {
  selectedModels: string[];
  onToggleModel: (model: string) => void;
  extraHeader?: React.ReactNode;
  filtersSummary?: string;
  filterModels?: string[];
  sources?: string[];
  from?: string | null;
  to?: string | null;
  granularity?: Granularity;
  refreshKey?: string | null;
  modelColorMap?: Record<string, string>;
};

export function UsageModelTable({
  selectedModels,
  onToggleModel,
  extraHeader,
  filtersSummary,
  filterModels,
  sources = [],
  from,
  to,
  granularity = "day",
  refreshKey,
  modelColorMap,
}: Props) {
  const [rows, setRows] = useState<UsageByModelRow[] | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [inlineDetailKey, setInlineDetailKey] = useState<string | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t, locale } = useI18n();
  const isZh = locale?.toLowerCase().startsWith("zh");
  const {
    state: { selectedChannels, modelGroupBy, selectedEfforts },
    actions: { beginRefresh, endRefresh, setModelGroupBy, setSelectedEfforts, setSelectedModels },
  } = useUsageFilters();

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(hover: none), (pointer: coarse)");
    const update = () => setIsTouch(mediaQuery.matches);
    update();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", update);
      return () => mediaQuery.removeEventListener("change", update);
    }
    mediaQuery.addListener(update);
    return () => mediaQuery.removeListener(update);
  }, []);

  useEffect(() => {
    if (modelGroupBy !== "raw") return;
    setExpandedKeys(new Set());
    setInlineDetailKey(null);
  }, [modelGroupBy]);

  useEffect(() => {
    const controller = new AbortController();
    let completed = false;
    const load = async () => {
      beginRefresh();
      const sp = new URLSearchParams();
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
      if (granularity) sp.set("granularity", granularity);
      sp.set("groupBySource", "true");
      const requestGroupBy = modelGroupBy === "raw" ? "raw" : "canonical_effort";
      sp.set("groupBy", requestGroupBy);
      if (modelGroupBy !== "raw" && selectedEfforts.length) {
        selectedEfforts.forEach((effort) => sp.append("efforts", effort));
      }
      sources.forEach((s) => sp.append("sources", s));
      selectedChannels.forEach((c) => sp.append("channels", c));
      const query = sp.toString();
      try {
        setError(null);
        const res = await fetch(`/api/usage/by-model${query ? `?${query}` : ""}`, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`${res.status} ${res.statusText}`);
        }
        const json = await res.json();
        const nextRows = Array.isArray(json.data) ? (json.data as UsageByModelRow[]) : [];
        setRows(nextRows);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        setRows([]);
      } finally {
        if (!controller.signal.aborted) {
          endRefresh();
          completed = true;
        }
      }
    };
    load();
    return () => {
      controller.abort();
      if (!completed) endRefresh();
    };
  }, [beginRefresh, endRefresh, from, granularity, modelGroupBy, refreshKey, selectedChannels, selectedEfforts, sources, to]);

  const tableModel = useMemo(() => {
    if (!rows) return null;
    return buildTableModel({ groupBy: modelGroupBy, effortFilter: selectedEfforts, data: rows });
  }, [modelGroupBy, rows, selectedEfforts]);

  const filterSet = useMemo(() => {
    if (!filterModels?.length) return null as null | Set<string>;
    if (modelGroupBy === "raw") return new Set(filterModels);
    const set = new Set<string>();
    filterModels.forEach((m) => set.add(normalizeModel({ model: m }).modelCanonical));
    return set;
  }, [filterModels, modelGroupBy]);

  const selectedSet = useMemo(() => {
    if (!selectedModels?.length) return null as null | Set<string>;
    if (modelGroupBy === "raw") return new Set(selectedModels);
    const set = new Set<string>();
    selectedModels.forEach((m) => set.add(normalizeModel({ model: m }).modelCanonical));
    return set;
  }, [modelGroupBy, selectedModels]);

  const view: TableViewModel | null = useMemo(() => {
    if (!tableModel) return null;
    if (!filterSet) return tableModel;

    if (tableModel.groupBy === "canonical") {
      return { ...tableModel, nodes: tableModel.nodes.filter((n) => filterSet.has(n.modelCanonical)) };
    }
    if (tableModel.groupBy === "canonical_effort") {
      return { ...tableModel, rows: tableModel.rows.filter((r) => filterSet.has(r.modelCanonical)) };
    }
    return { ...tableModel, rows: tableModel.rows.filter((r) => filterSet.has(r.modelRaw)) };
  }, [filterSet, tableModel]);

  const { maxTokens, maxCost } = useMemo(() => {
    if (!view) return { maxTokens: 0, maxCost: 0 };
    const metricsList =
      view.groupBy === "canonical"
        ? view.nodes.map((n) => n.metrics)
        : view.rows.map((r) => r.metrics);
    if (metricsList.length === 0) return { maxTokens: 0, maxCost: 0 };
    return {
      maxTokens: Math.max(...metricsList.map((m) => Number(m.totalTokens ?? 0))),
      maxCost: Math.max(...metricsList.map((m) => Number(m.costUsd ?? 0))),
    };
  }, [view]);

  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!rows) {
    return <Skeleton className="h-80" />;
  }

  return (
    <Card className="w-full border border-border bg-card text-card-foreground shadow-lg">
      <CardHeader className="pb-2">
        <div>
          <CardTitle className="text-card-foreground">{t("topModels")}</CardTitle>
          {filtersSummary ? (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{filtersSummary}</p>
          ) : null}
          {error ? <p className="text-xs text-destructive mt-1">{error}</p> : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <ViewModeToggle
              value={modelGroupBy}
              onChange={(next) => setModelGroupBy(next)}
              locale={locale}
            />
            <EffortFilter
              value={selectedEfforts}
              onChange={setSelectedEfforts}
              disabled={modelGroupBy === "raw"}
              locale={locale}
            />
          </div>
          {extraHeader}
        </div>

        {modelGroupBy === "raw" ? (
          <RawWarningBanner locale={locale} onBackToDefault={() => setModelGroupBy("canonical")} />
        ) : null}

        <div className="overflow-x-auto">
          <Table className="min-w-[820px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-64">{t("model")}</TableHead>
                <TableHead className="w-28 text-right hidden sm:table-cell">{t("requests")}</TableHead>
                <TableHead className="w-28 text-right text-destructive hidden sm:table-cell">
                  <span className="inline-flex w-full items-center justify-end gap-1">
                    {t("failedRequests")}
                    <UiTooltip>
                      <UiTooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex items-center text-muted-foreground hover:text-foreground"
                          aria-label={t("failedRequestsTooltip")}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </UiTooltipTrigger>
                      <UiTooltipContent side="top" className="max-w-[260px] text-xs leading-relaxed">
                        {t("failedRequestsTooltip")}
                      </UiTooltipContent>
                    </UiTooltip>
                  </span>
                </TableHead>
                <TableHead className="w-64">{t("totalTokens")}</TableHead>
                <TableHead className="w-44 hidden md:table-cell">{t("cacheHitRate")}</TableHead>
                <TableHead className="w-44">{t("costUsd")}</TableHead>
                <TableHead className="w-24 text-right hidden sm:table-cell">{t("effort")}</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              <UsageModelTableRows
                view={view}
                locale={locale}
                isZh={Boolean(isZh)}
                t={t}
                modelColorMap={modelColorMap}
                maxTokens={maxTokens}
                maxCost={maxCost}
                selectedSet={selectedSet}
                expandedKeys={expandedKeys}
                toggleExpanded={toggleExpanded}
                inlineDetailKey={inlineDetailKey}
                setInlineDetailKey={setInlineDetailKey}
                isTouch={isTouch}
                onToggleModel={onToggleModel}
                selectedEffortsCount={selectedEfforts.length}
                hasModelFilter={Boolean(filterModels?.length)}
                onClearEfforts={() => setSelectedEfforts([])}
                onClearModels={() => setSelectedModels([])}
              />
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
