'use client';

import { Fragment, useEffect, useMemo, useState } from "react";
import { ChevronRight, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/components/i18n-context";
import { cn } from "@/lib/utils";
import { Tooltip as UiTooltip, TooltipContent as UiTooltipContent, TooltipTrigger as UiTooltipTrigger } from "@/components/ui/tooltip";
import { resolveModelColor } from "@/lib/model-colors";
import { formatSourceLabel, getSourceColor, getSourceIcon } from "@/lib/source-utils";
import type { Granularity } from "@/components/usage/granularity-select";
import { useUsageFilters } from "@/lib/usage/usage-filters-context";
import { ModelUsageDetail } from "@/components/charts/model-usage-detail";
import { ModelUsageDetailTrigger } from "@/components/charts/model-usage-detail-trigger";

type ModelRow = {
  model: string;
  totalTokens: number;
  cachedTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  costUsd: number;
  inputCostUsd: number | null;
  outputCostUsd: number | null;
  cachedCostUsd: number | null;
  pricingConfigured: boolean;
  requestCount: number;
  failureCount?: number;
  cacheHitRate?: number;
};

type SourceRow = ModelRow & { authSource: string | null };

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

export function UsageModelTable({ selectedModels, onToggleModel, extraHeader, filtersSummary, filterModels, sources = [], from, to, granularity = "day", refreshKey, modelColorMap }: Props) {
  const [data, setData] = useState<ModelRow[] | null>(null);
  const [sourceMap, setSourceMap] = useState<Record<string, SourceRow[]>>({});
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [inlineDetailModel, setInlineDetailModel] = useState<string | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { t, locale } = useI18n();
  const {
    state: { selectedChannels },
    actions: { beginRefresh, endRefresh },
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
    const controller = new AbortController();
    let completed = false;
    const load = async () => {
      beginRefresh();
      const sp = new URLSearchParams();
      if (from) sp.set("from", from);
      if (to) sp.set("to", to);
      if (granularity) sp.set("granularity", granularity);
      sp.set("groupBySource", "true");
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
        const rows = (json.data ?? []) as SourceRow[];
        const enrichedSources = rows.map((row) => {
          const total = Number(row.totalTokens ?? 0);
          const cached = Number(row.cachedTokens ?? 0);
          const inputTokens = Number(row.inputTokens ?? 0);
          const outputTokens = Number(row.outputTokens ?? 0);
          const reasoningTokens = Number(row.reasoningTokens ?? 0);
          const rawCostUsd = Number(row.costUsd ?? 0);
          const costUsd = Number.isFinite(rawCostUsd) ? rawCostUsd : 0;
          const inputCostUsd = row.inputCostUsd == null ? null : Number(row.inputCostUsd);
          const outputCostUsd = row.outputCostUsd == null ? null : Number(row.outputCostUsd);
          const cachedCostUsd = row.cachedCostUsd == null ? null : Number(row.cachedCostUsd);
          const pricingConfigured = Boolean(row.pricingConfigured);
          const failures = Number(row.failureCount ?? 0);
          const rate =
            typeof row.cacheHitRate === "number"
              ? row.cacheHitRate
              : total > 0
                ? cached / total
                : 0;
          return {
            ...row,
            costUsd,
            totalTokens: total,
            cachedTokens: cached,
            inputTokens,
            outputTokens,
            reasoningTokens,
            inputCostUsd,
            outputCostUsd,
            cachedCostUsd,
            pricingConfigured,
            cacheHitRate: rate,
            failureCount: failures,
          };
        });

        const parentMap = new Map<string, ModelRow>();
        const childMap: Record<string, SourceRow[]> = {};
        const sumNullable = (current: number | null, next: number | null) =>
          current === null || next === null ? null : current + next;

        enrichedSources.forEach((row) => {
          const existing = parentMap.get(row.model);
          const parent = existing ?? {
            model: row.model,
            totalTokens: 0,
            cachedTokens: 0,
            inputTokens: 0,
            outputTokens: 0,
            reasoningTokens: 0,
            costUsd: 0,
            inputCostUsd: 0,
            outputCostUsd: 0,
            cachedCostUsd: 0,
            pricingConfigured: true,
            requestCount: 0,
            failureCount: 0,
            cacheHitRate: 0,
          };

          parent.totalTokens += row.totalTokens;
          parent.cachedTokens += row.cachedTokens;
          parent.inputTokens += row.inputTokens;
          parent.outputTokens += row.outputTokens;
          parent.reasoningTokens += row.reasoningTokens;
          parent.costUsd += row.costUsd;
          parent.inputCostUsd = existing
            ? sumNullable(parent.inputCostUsd, row.inputCostUsd)
            : row.inputCostUsd;
          parent.outputCostUsd = existing
            ? sumNullable(parent.outputCostUsd, row.outputCostUsd)
            : row.outputCostUsd;
          parent.cachedCostUsd = existing
            ? sumNullable(parent.cachedCostUsd, row.cachedCostUsd)
            : row.cachedCostUsd;
          parent.pricingConfigured = existing
            ? parent.pricingConfigured && row.pricingConfigured
            : row.pricingConfigured;
          parent.requestCount += Number(row.requestCount ?? 0);
          parent.failureCount = (parent.failureCount ?? 0) + Number(row.failureCount ?? 0);
          parentMap.set(row.model, parent);

          if (!childMap[row.model]) childMap[row.model] = [];
          childMap[row.model].push(row);
        });

        // compute cacheHitRate for parents
        parentMap.forEach((parent, key) => {
          const rate = parent.totalTokens > 0 ? parent.cachedTokens / parent.totalTokens : 0;
          parentMap.set(key, { ...parent, cacheHitRate: rate });
        });

        // sort child rows by totalTokens desc
        Object.keys(childMap).forEach((key) => {
          childMap[key] = childMap[key]
            .slice()
            .sort((a, b) => Number(b.totalTokens ?? 0) - Number(a.totalTokens ?? 0));
        });

        setData(Array.from(parentMap.values()));
        setSourceMap(childMap);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        setData([]);
        setSourceMap({});
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
  }, [beginRefresh, endRefresh, from, granularity, refreshKey, selectedChannels, sources, to]);

  const visibleRows = useMemo(() => {
    if (!data) return [] as ModelRow[];
    if (!filterModels || filterModels.length === 0) return data;
    const set = new Set(filterModels);
    return data.filter((row) => set.has(row.model));
  }, [data, filterModels]);

  const sortedRows = useMemo(() => {
    return [...visibleRows].sort((a, b) => {
      const tokenDiff = Number(b.totalTokens ?? 0) - Number(a.totalTokens ?? 0);
      if (tokenDiff !== 0) return tokenDiff;
      const cacheDiff = Number(b.cacheHitRate ?? 0) - Number(a.cacheHitRate ?? 0);
      if (cacheDiff !== 0) return cacheDiff;
      return Number(b.costUsd ?? 0) - Number(a.costUsd ?? 0);
    });
  }, [visibleRows]);

  const { maxTokens, maxCost } = useMemo(() => {
    if (!visibleRows.length) return { maxTokens: 0, maxCost: 0 };
    return {
      maxTokens: Math.max(...visibleRows.map((d) => Number(d.totalTokens ?? 0))),
      maxCost: Math.max(...visibleRows.map((d) => Number(d.costUsd ?? 0))),
    };
  }, [visibleRows]);

  if (!data) {
    return <Skeleton className="h-80" />;
  }

  return (
    <Card className="w-full border border-border bg-card text-card-foreground shadow-lg">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="text-card-foreground">{t("topModels")}</CardTitle>
            {filtersSummary && (
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{filtersSummary}</p>
            )}
            {error && <p className="text-xs text-destructive mt-1">{error}</p>}
          </div>
          {extraHeader}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="overflow-x-auto">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-64">{t("model")}</TableHead>
                <TableHead className="w-28 text-right">{t("requests")}</TableHead>
                <TableHead className="w-28 text-right text-destructive">
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
                <TableHead className="w-44">{t("cacheHitRate")}</TableHead>
                <TableHead className="w-44">{t("costUsd")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.map((row, idx) => {
                const rowColor = resolveModelColor(row.model, modelColorMap, idx);
                const isSelected = selectedModels.includes(row.model);
                const isExpanded = expanded.has(row.model);
                const children = sourceMap[row.model] ?? [];
                const isInlineOpen = inlineDetailModel === row.model;
                return (
                  <Fragment key={row.model}>
                    <TableRow
                      aria-selected={isSelected}
                      style={{ borderLeftColor: isSelected ? rowColor : "transparent" }}
                      className={cn(
                        "cursor-pointer border-l-4 transition-colors",
                        isSelected ? "bg-primary/5 shadow-inner" : "hover:bg-accent/10",
                      )}
                      onClick={() => onToggleModel(row.model)}
                    >
                      <TableCell className="font-medium text-card-foreground">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex items-center gap-2 text-left"
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpanded((prev) => {
                                const next = new Set(prev);
                                if (next.has(row.model)) next.delete(row.model);
                                else next.add(row.model);
                                return next;
                              });
                            }}
                          >
                            <ChevronRight
                              className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")}
                              aria-label={isExpanded ? t("collapseRow") : t("expandRow")}
                            />
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: rowColor }} />
                            <UiTooltip>
                              <UiTooltipTrigger asChild>
                                <span className={cn("truncate", isSelected && "font-semibold")}>{row.model}</span>
                              </UiTooltipTrigger>
                              <UiTooltipContent side="top" className="font-mono text-xs">
                                {row.model}
                              </UiTooltipContent>
                            </UiTooltip>
                          </button>
                          <ModelUsageDetailTrigger
                            row={row}
                            isTouch={isTouch}
                            inlineOpen={isInlineOpen}
                            onToggleInline={() =>
                              setInlineDetailModel((prev) => (prev === row.model ? null : row.model))
                            }
                          />
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm text-muted-foreground text-right">
                        {row.requestCount}
                      </TableCell>
                      <TableCell className="font-mono text-sm text-right text-destructive">
                        {row.failureCount ?? 0}
                      </TableCell>
                      <TableCell>
                        <MetricCell
                          primary={formatCompact(row.totalTokens, locale)}
                          secondary={row.cachedTokens > 0 ? formatCompact(row.cachedTokens, locale) : undefined}
                          percent={maxTokens ? (row.totalTokens / maxTokens) * 100 : 0}
                          barColor={rowColor}
                          trackColor="var(--muted)"
                        />
                      </TableCell>
                      <TableCell>
                        <CacheRateCell rate={row.cacheHitRate} cachedTokens={row.cachedTokens} locale={locale} />
                      </TableCell>
                      <TableCell>
                        <MetricCell
                          primary={formatCurrency(row.costUsd, locale)}
                          percent={maxCost ? (row.costUsd / maxCost) * 100 : 0}
                          barColor={rowColor}
                          trackColor="var(--muted)"
                        />
                      </TableCell>
                    </TableRow>
                    {isTouch && isInlineOpen ? (
                      <TableRow className="bg-muted/20">
                        <TableCell colSpan={6}>
                          <ModelUsageDetail row={row} variant="inline" />
                        </TableCell>
                      </TableRow>
                    ) : null}
                    {isExpanded && children.length
                      ? children.map((child) => {
                          const Icon = getSourceIcon(child.authSource ?? undefined);
                          const color = getSourceColor(child.authSource ?? undefined);
                          const percentOfModel = row.totalTokens > 0 ? (child.totalTokens / row.totalTokens) * 100 : 0;
                          const percentCost = row.costUsd > 0 ? (child.costUsd / row.costUsd) * 100 : 0;
                          return (
                            <TableRow key={`${row.model}-${child.authSource ?? "unknown"}`} className="bg-muted/30">
                              <TableCell className="w-64">
                                <div className="flex items-center gap-2 pl-7">
                                  <Icon className="h-4 w-4" style={{ color }} />
                                  <span className="text-muted-foreground truncate">{formatSourceLabel(child.authSource)}</span>
                                </div>
                              </TableCell>
                              <TableCell className="w-28 text-right font-mono text-sm text-muted-foreground">
                                {child.requestCount}
                              </TableCell>
                              <TableCell className="w-28 text-right font-mono text-sm text-destructive">
                                {child.failureCount ?? 0}
                              </TableCell>
                              <TableCell className="w-64">
                                <MetricCell
                                  primary={formatCompact(child.totalTokens, locale)}
                                  secondary={child.cachedTokens > 0 ? formatCompact(child.cachedTokens, locale) : undefined}
                                  percent={percentOfModel}
                                  barColor={color}
                                  trackColor="var(--muted)"
                                />
                              </TableCell>
                              <TableCell className="w-44">
                                <CacheRateCell rate={child.cacheHitRate} cachedTokens={child.cachedTokens} locale={locale} />
                              </TableCell>
                              <TableCell className="w-44">
                                <MetricCell
                                  primary={formatCurrency(child.costUsd, locale)}
                                  percent={percentCost}
                                  barColor={color}
                                  trackColor="var(--muted)"
                                />
                              </TableCell>
                            </TableRow>
                          );
                        })
                      : null}
                  </Fragment>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function MetricCell({
  primary,
  secondary,
  percent,
  barColor,
  trackColor = "var(--muted)",
}: {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  percent: number;
  barColor?: string;
  trackColor?: string;
}) {
  const widthPct = Number.isFinite(percent) ? Math.min(Math.max(percent, 0), 100) : 0;
  return (
    <div className="flex w-full min-w-[140px] flex-col justify-center">
      <div className="mb-1.5 flex h-5 items-baseline justify-between">
        <span className="text-sm font-medium tabular-nums leading-none text-card-foreground">{primary}</span>
        {secondary ? (
          <span className="text-xs text-muted-foreground tabular-nums leading-none ml-2">{secondary}</span>
        ) : null}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: trackColor }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${widthPct}%`, backgroundColor: barColor ?? "var(--chart-1)" }}
        />
      </div>
    </div>
  );
}

function formatPercent(rate?: number, locale?: string) {
  if (!Number.isFinite(rate)) return "—";
  const clamped = Math.max(0, Math.min(1, rate as number));
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(clamped);
}

function formatCompact(value: number, locale?: string) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCurrency(value: number, locale?: string) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
}

function CacheRateCell({ rate, cachedTokens, locale }: { rate?: number; cachedTokens: number; locale?: string }) {
  if (!Number.isFinite(rate)) {
    return <span className="text-muted-foreground">—</span>;
  }

  const clamped = Math.max(0, Math.min(1, rate as number));

  return (
    <MetricCell
      primary={formatPercent(clamped, locale)}
      secondary={cachedTokens > 0 ? formatCompact(cachedTokens, locale) : undefined}
      percent={clamped * 100}
      barColor="var(--chart-2)"
      trackColor="var(--muted)"
    />
  );
}
