"use client";

import { useMemo, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useI18n } from "@/components/i18n-context";
import { UsageChartHeader } from "./ui/chart-header";
import { AggregatePanel } from "./ui/aggregate-panel";
import { PerModelPanel } from "./ui/per-model-panel";
import { useUsageQuery } from "./hooks/use-usage-query";
import { useUsageSeries } from "./hooks/use-usage-series";
import { useMetricToggles } from "./hooks/use-metric-toggles";
import { useChartLegend } from "./hooks/use-chart-legend";
import { useTickFormatter } from "./hooks/use-tick-formatter";
import type { Dimension, Granularity, UsageChartMetricKey, ViewMode } from "./types";
import { buildModelColorMap } from "@/lib/model-colors";
import { getSourceColor } from "@/lib/source-utils";
import { getChannelColor } from "@/lib/channel-utils";

type Props = {
  filterModels?: string[];
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  granularity?: Granularity;
  dimension?: Dimension;
  focusModels?: string[];
  from?: string | null;
  to?: string | null;
  refreshKey?: string | null;
  modelColorMap?: Record<string, string>;
  sources?: string[];
};

const TOKEN_COLOR = "var(--chart-1)";
const CACHE_COLOR = "var(--chart-2)";
const COST_COLOR = "var(--chart-3)";

export function UsageMainChart({
  filterModels,
  viewMode,
  onChangeViewMode,
  granularity = "day",
  dimension,
  focusModels = [],
  from,
  to,
  refreshKey,
  modelColorMap,
  sources,
}: Props) {
  const { t } = useI18n();
  const {
    aggregateData,
    perModelData,
    perSourceData,
    perChannelData,
    perChannelModelData,
    normalizedFilterModels,
    normalizedSources,
    normalizedChannels,
    isLoading,
    error,
    hasLoadedAggregate,
    hasLoadedPerModel,
    hasLoadedSource,
    hasLoadedChannel,
    hasLoadedChannelModel,
  } = useUsageQuery({ filterModels, viewMode, granularity, from, to, refreshKey, sources, dimension });
  const limitSourceModelSeries = viewMode === "source-model" && !normalizedFilterModels.length && !normalizedSources.length ? 10 : undefined;
  const limitChannelModelSeries = viewMode === "channel-model" && !normalizedFilterModels.length ? 10 : undefined;
  const { aggregateSeries, modelSeries, sourceSeries, sourceModelSeries, channelSeries, channelModelSeries } = useUsageSeries({
    aggregateData,
    perModelData,
    perSourceData,
    perChannelData,
    perChannelModelData,
    limitSourceModelSeries,
    limitChannelModelSeries,
  });
  const metricLabels: Record<UsageChartMetricKey, string> = {
    computedTokens: t("computedTokens"),
    cachedTokens: t("cachedTokens"),
    costUsd: t("costUsd"),
  };
  const { metrics, metricConfig, toggleMetric } = useMetricToggles(metricLabels);
  const activeSeries = viewMode === "source"
    ? sourceSeries
    : viewMode === "source-model"
      ? sourceModelSeries
      : viewMode === "channel"
        ? channelSeries
        : viewMode === "channel-model"
          ? channelModelSeries
          : modelSeries;
  const activeFilterIds = viewMode === "source"
    ? normalizedSources
    : viewMode === "channel"
      ? normalizedChannels
      : viewMode === "source-model" || viewMode === "channel-model"
        ? []
        : normalizedFilterModels;
  const focusForLegend = viewMode === "per-model" ? focusModels : [];
  const legend = useChartLegend({
    series: activeSeries,
    filterModels: activeFilterIds,
    focusModels: focusForLegend,
  });
  const formatTick = useTickFormatter(granularity);
  const cardRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const cardsContainerRef = useRef<HTMLDivElement | null>(null);

  const resolvedColorMap = useMemo(() => {
    if (viewMode === "source") {
      const ids = legend.orderedLegendModels.length
        ? legend.orderedLegendModels
        : sourceSeries.map((item) => item.model);
      const map: Record<string, string> = {};
      ids.forEach((id) => {
        map[id] = getSourceColor(id);
      });
      return map;
    }

    if (viewMode === "source-model") {
      const ids = legend.orderedLegendModels.length
        ? legend.orderedLegendModels
        : sourceModelSeries.map((item) => item.model);
      const map: Record<string, string> = {};
      ids.forEach((id) => {
        const seriesItem = sourceModelSeries.find((item) => item.model === id);
        const sourceId = seriesItem?.sourceId ?? id;
        map[id] = getSourceColor(sourceId);
      });
      return map;
    }

    if (viewMode === "channel") {
      const ids = legend.orderedLegendModels.length
        ? legend.orderedLegendModels
        : channelSeries.map((item) => item.model);
      const map: Record<string, string> = {};
      ids.forEach((id) => {
        map[id] = getChannelColor(id);
      });
      return map;
    }

    if (viewMode === "channel-model") {
      const ids = legend.orderedLegendModels.length
        ? legend.orderedLegendModels
        : channelModelSeries.map((item) => item.model);
      const map: Record<string, string> = {};
      ids.forEach((id) => {
        const seriesItem = channelModelSeries.find((item) => item.model === id);
        const channelId = seriesItem?.sourceId ?? id;
        map[id] = getChannelColor(channelId);
      });
      return map;
    }

    if (modelColorMap && Object.keys(modelColorMap).length > 0) return modelColorMap;
    const ids = legend.orderedLegendModels.length
      ? legend.orderedLegendModels
      : modelSeries.map((item) => item.model);
    return buildModelColorMap(ids);
  }, [channelModelSeries, channelSeries, legend.orderedLegendModels, modelColorMap, modelSeries, sourceModelSeries, sourceSeries, viewMode]);

  const targetFocusedId = useMemo(() => {
    if (!focusModels.length) return null;
    return focusModels.find((id) => legend.orderedVisibleModels.includes(id)) ?? null;
  }, [focusModels, legend.orderedVisibleModels]);

  const groupedSeriesGroups = useMemo(() => {
    if (viewMode !== "source-model" && viewMode !== "channel-model") {
      return [] as { sourceId: string; sourceLabel: string; items: { id: string; label: string; color: string }[] }[];
    }
    const list = viewMode === "source-model" ? sourceModelSeries : channelModelSeries;
    const map = new Map<string, { sourceId: string; sourceLabel: string; items: { id: string; label: string; color: string }[] }>();
    list.forEach((series) => {
      const sourceId = series.sourceId ?? "unknown";
      const group = map.get(sourceId) ?? {
        sourceId,
        sourceLabel: series.sourceLabel ?? sourceId,
        items: [],
      };
      const label = series.modelLabel ?? series.model;
      group.items.push({ id: series.model, label, color: resolvedColorMap[series.model] ?? TOKEN_COLOR });
      map.set(sourceId, group);
    });
    return Array.from(map.values()).sort((a, b) => a.sourceLabel.localeCompare(b.sourceLabel));
  }, [viewMode, sourceModelSeries, channelModelSeries, resolvedColorMap]);

  const showAggregateSkeleton = viewMode === "aggregate" && !hasLoadedAggregate && isLoading;
  const showPerModelSkeleton = (viewMode === "per-model" || viewMode === "source-model") && !hasLoadedPerModel && isLoading;
  const showSourceSkeleton = viewMode === "source" && !hasLoadedSource && isLoading;
  const showChannelSkeleton = viewMode === "channel" && !hasLoadedChannel && isLoading;
  const showChannelModelSkeleton = viewMode === "channel-model" && !hasLoadedChannelModel && isLoading;
  const showLimitNotice =
    (viewMode === "source-model" && Boolean(limitSourceModelSeries) && (perModelData?.length ?? 0) > (limitSourceModelSeries ?? 0)) ||
    (viewMode === "channel-model" && Boolean(limitChannelModelSeries) && (perChannelModelData?.length ?? 0) > (limitChannelModelSeries ?? 0));

  const legendProps = (viewMode === "per-model" || viewMode === "source" || viewMode === "channel" || viewMode === "source-model" || viewMode === "channel-model") && legend.orderedLegendModels.length
    ? (viewMode === "source-model" || viewMode === "channel-model")
      ? {
          type: "grouped" as const,
          items: legend.orderedLegendModels,
          visibleSet: legend.visibleModelSet,
          onToggle: legend.handleLegendToggle,
          onToggleGroup: (groupId: string, childIds: string[]) => {
            legend.setVisibleModels((prev) => {
              const baseSet = prev.length ? new Set(prev) : new Set(legend.orderedLegendModels);
              const allActive = childIds.every((id) => baseSet.has(id));
              if (allActive) {
                const next = Array.from(baseSet).filter((id) => !childIds.includes(id));
                return next;
              }
              childIds.forEach((id) => baseSet.add(id));
              return Array.from(baseSet);
            });
          },
          colorMap: resolvedColorMap,
          groups: groupedSeriesGroups,
        }
      : {
          type: "flat" as const,
          items: legend.orderedLegendModels,
          visibleSet: legend.visibleModelSet,
          focusModels: focusForLegend,
          colorMap: resolvedColorMap,
          onToggle: legend.handleLegendToggle,
          onReorder: legend.handleLegendReorder,
        }
    : undefined;

  return (
    <Card className="w-full border border-border bg-card text-card-foreground shadow-lg">
      <CardHeader className="pb-2">
        <UsageChartHeader
          viewMode={viewMode}
          onChangeViewMode={onChangeViewMode}
          metricConfig={metricConfig}
          metrics={metrics}
          onToggleMetric={toggleMetric}
          legend={legendProps}
        />
      </CardHeader>
      <CardContent className="space-y-4 h-[380px] md:h-[400px]">
        {showLimitNotice ? (
          <div className="flex items-center gap-2 rounded-md border border-dashed border-border/60 bg-muted/20 px-3 py-2 text-[12px] text-muted-foreground">
            {t("showingTopCombinations") ?? "当前仅展示成本最高的前 10 个组合，建议通过提供商或模型筛选缩小范围。"}
          </div>
        ) : null}
        {viewMode === "aggregate" ? (
          <AggregatePanel
            data={aggregateSeries}
            metrics={metrics}
            metricConfig={metricConfig}
            formatTick={formatTick}
            chartSyncId="usage-main-aggregate"
            showSkeleton={showAggregateSkeleton}
            error={error}
          onToggleMetric={toggleMetric}
          />
        ) : viewMode === "per-model" ? (
          <PerModelPanel
            series={modelSeries}
            orderedVisibleModels={legend.orderedVisibleModels}
            metrics={metrics}
            baseTokenColor={TOKEN_COLOR}
            baseCacheColor={CACHE_COLOR}
            baseCostColor={COST_COLOR}
            modelColorMap={resolvedColorMap}
            formatTick={formatTick}
            focusModels={focusModels}
            cardRefs={cardRefs}
            containerRef={cardsContainerRef as React.RefObject<HTMLDivElement>}
            targetFocusedId={targetFocusedId}
            showSkeleton={showPerModelSkeleton}
            error={error}
          onToggleMetric={toggleMetric}
          />
        ) : viewMode === "source-model" ? (
          <PerModelPanel
            series={sourceModelSeries}
            orderedVisibleModels={legend.orderedVisibleModels}
            metrics={metrics}
            baseTokenColor={TOKEN_COLOR}
            baseCacheColor={CACHE_COLOR}
            baseCostColor={COST_COLOR}
            modelColorMap={resolvedColorMap}
            formatTick={formatTick}
            focusModels={[]}
            cardRefs={cardRefs}
            containerRef={cardsContainerRef as React.RefObject<HTMLDivElement>}
            targetFocusedId={null}
            showSkeleton={showPerModelSkeleton}
            error={error}
            onToggleMetric={toggleMetric}
          />
        ) : viewMode === "channel-model" ? (
          <PerModelPanel
            series={channelModelSeries}
            orderedVisibleModels={legend.orderedVisibleModels}
            metrics={metrics}
            baseTokenColor={TOKEN_COLOR}
            baseCacheColor={CACHE_COLOR}
            baseCostColor={COST_COLOR}
            modelColorMap={resolvedColorMap}
            formatTick={formatTick}
            focusModels={[]}
            cardRefs={cardRefs}
            containerRef={cardsContainerRef as React.RefObject<HTMLDivElement>}
            targetFocusedId={null}
            showSkeleton={showChannelModelSkeleton}
            error={error}
            onToggleMetric={toggleMetric}
          />
        ) : viewMode === "channel" ? (
          <PerModelPanel
            series={channelSeries}
            orderedVisibleModels={legend.orderedVisibleModels}
            metrics={metrics}
            baseTokenColor={TOKEN_COLOR}
            baseCacheColor={CACHE_COLOR}
            baseCostColor={COST_COLOR}
            modelColorMap={resolvedColorMap}
            formatTick={formatTick}
            focusModels={[]}
            cardRefs={cardRefs}
            containerRef={cardsContainerRef as React.RefObject<HTMLDivElement>}
            targetFocusedId={null}
            showSkeleton={showChannelSkeleton}
            error={error}
            onToggleMetric={toggleMetric}
          />
        ) : (
          <PerModelPanel
            series={sourceSeries}
            orderedVisibleModels={legend.orderedVisibleModels}
            metrics={metrics}
            baseTokenColor={TOKEN_COLOR}
            baseCacheColor={CACHE_COLOR}
            baseCostColor={COST_COLOR}
            modelColorMap={resolvedColorMap}
            formatTick={formatTick}
            focusModels={[]}
            cardRefs={cardRefs}
            containerRef={cardsContainerRef as React.RefObject<HTMLDivElement>}
            targetFocusedId={null}
            showSkeleton={showSourceSkeleton}
            error={error}
          onToggleMetric={toggleMetric}
          />
        )}
      </CardContent>
    </Card>
  );
}
