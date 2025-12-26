"use client";

import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-context";
import { ModelCard } from "./model-card";
import { useFocusScroll } from "../hooks/use-focus-scroll";
import type { ModelSeries, ModelSeriesPoint, UsageChartMetricKey, UsageChartMetrics } from "../types";
import { resolveModelColor } from "@/lib/model-colors";

type Props = {
  series: ModelSeries[];
  orderedVisibleModels: string[];
  metrics: UsageChartMetrics;
  baseTokenColor: string;
  baseCacheColor: string;
  baseCostColor: string;
  modelColorMap?: Record<string, string>;
  formatTick: (value: string) => string;
  focusModels: string[];
  cardRefs: React.MutableRefObject<Map<string, HTMLDivElement | null>>;
  containerRef: React.RefObject<HTMLDivElement>;
  targetFocusedId: string | null;
  showSkeleton: boolean;
  error?: string | null;
  onToggleMetric: (key: UsageChartMetricKey) => void;
};

export const PerModelPanel = memo(function PerModelPanel({
  series,
  orderedVisibleModels,
  metrics,
  baseTokenColor,
  baseCacheColor,
  baseCostColor,
  modelColorMap,
  formatTick,
  focusModels,
  cardRefs,
  containerRef,
  targetFocusedId,
  showSkeleton,
  error,
  onToggleMetric,
}: Props) {
  const { t } = useI18n();
  const visibleSeries = useMemo(() => {
    const map = new Map(series.map((model) => [model.model, model] as const));
    return orderedVisibleModels.map((id) => map.get(id)).filter(Boolean) as ModelSeries[];
  }, [series, orderedVisibleModels]);

  const alignedSeries = useMemo(() => {
    if (visibleSeries.length <= 1) return visibleSeries;

    const bucketSet = new Set<string>();
    visibleSeries.forEach((seriesItem) => {
      seriesItem.points.forEach((point) => {
        if (point.bucket) bucketSet.add(point.bucket);
      });
    });

    const allBuckets = Array.from(bucketSet).sort((a, b) => {
      const timeA = new Date(a).getTime();
      const timeB = new Date(b).getTime();
      if (Number.isNaN(timeA) || Number.isNaN(timeB)) return a.localeCompare(b);
      if (timeA !== timeB) return timeA - timeB;
      return a.localeCompare(b);
    });

    const makeEmptyPoint = (bucket: string): ModelSeriesPoint => ({
      bucket,
      totalTokens: 0,
      cachedTokens: 0,
      computedTokens: 0,
      chartCachedTokens: 0.1,
      chartComputedTokens: 0.1,
      costUsd: 0,
    });

    return visibleSeries.map((seriesItem) => {
      const pointMap = new Map(seriesItem.points.map((point) => [point.bucket, point] as const));
      return {
        ...seriesItem,
        points: allBuckets.map((bucket) => pointMap.get(bucket) ?? makeEmptyPoint(bucket)),
      };
    });
  }, [visibleSeries]);

  useFocusScroll({ focusedId: targetFocusedId, cardRefs, containerRef, watchKey: orderedVisibleModels.join("|") });

  if (showSkeleton) {
    return <div className="h-[360px]"><div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading…</div></div>;
  }

  return (
    <div
      className={cn(
        "max-h-[360px] overflow-y-auto pr-2",
        "[&::-webkit-scrollbar]:w-1.5",
        "[&::-webkit-scrollbar-track]:bg-transparent",
        "[&::-webkit-scrollbar-thumb]:rounded-full",
        "[&::-webkit-scrollbar-thumb]:bg-muted-foreground/20",
        "[&::-webkit-scrollbar-thumb]:hover:bg-muted-foreground/40",
      )}
      ref={containerRef}
    >
      {error ? (
        <div className="flex h-40 items-center justify-center text-sm text-destructive">{error}</div>
      ) : visibleSeries.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">{t("noModels")}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {alignedSeries.map((seriesItem, idx) => {
            const modelColor = resolveModelColor(seriesItem.model, modelColorMap, idx);

            return (
              <ModelCard
                key={seriesItem.model}
                ref={(node) => {
                  if (node) cardRefs.current.set(seriesItem.model, node);
                  else cardRefs.current.delete(seriesItem.model);
                }}
                modelId={seriesItem.model}
                modelLabel={seriesItem.modelLabel}
                sourceLabel={seriesItem.sourceLabel}
                data={seriesItem.points}
                totals={seriesItem.totals}
                metrics={metrics}
                modelColor={modelColor}
                tokenColor={baseTokenColor}
                cacheColor={baseCacheColor}
                costColor={baseCostColor}
                formatTick={formatTick}
                focused={focusModels.includes(seriesItem.model)}
                onToggleMetric={onToggleMetric}
              />
            );
          })}
        </div>
      )}
    </div>
  );
});
