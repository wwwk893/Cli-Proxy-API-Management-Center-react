"use client";

import { CardTitle } from "@/components/ui/card";
import { useI18n } from "@/components/i18n-context";
import { cn } from "@/lib/utils";
import { LegendPill } from "./legend-pill";
import { DraggableLegend } from "./draggable-legend";
import type { UsageChartMetricKey, UsageChartMetrics, ViewMode } from "../types";
import { GroupedLegend } from "./grouped-legend";

type Props = {
  viewMode: ViewMode;
  onChangeViewMode: (mode: ViewMode) => void;
  metricConfig: { key: UsageChartMetricKey; color: string; label: string }[];
  metrics: UsageChartMetrics;
  onToggleMetric: (key: UsageChartMetricKey) => void;
  legend?:
    | {
        type?: "flat";
        items: string[];
        visibleSet: Set<string>;
        focusModels: string[];
        onToggle: (id: string) => void;
        onReorder?: (fromId: string, toId: string) => void;
        colorMap: Record<string, string>;
      }
    | {
        type: "grouped";
        items: string[];
        visibleSet: Set<string>;
        onToggle: (id: string) => void;
        onToggleGroup: (groupId: string, childIds: string[]) => void;
        groups: {
          sourceId: string;
          sourceLabel: string;
          items: { id: string; label: string; color: string }[];
        }[];
      };
};

export function UsageChartHeader({ viewMode, onChangeViewMode, metricConfig, metrics, onToggleMetric, legend }: Props) {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <CardTitle className="text-card-foreground">{t("tokenVolumeCost")}</CardTitle>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <div className="flex items-center rounded-lg bg-muted/40 p-1 text-[11px]">
          <button
            type="button"
            className={cn(
              "px-3 py-1 rounded-md transition-all",
              viewMode === "aggregate"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onChangeViewMode("aggregate")}
          >
            {t("aggregateView")}
          </button>
          <button
            type="button"
            className={cn(
              "px-3 py-1 rounded-md transition-all",
              viewMode === "per-model"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onChangeViewMode("per-model")}
          >
            {t("perModelView")}
          </button>
          <button
            type="button"
            className={cn(
              "px-3 py-1 rounded-md transition-all",
              viewMode === "source"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onChangeViewMode("source")}
          >
            {t("bySource") ?? "按来源"}
          </button>
          <button
            type="button"
            className={cn(
              "px-3 py-1 rounded-md transition-all",
              viewMode === "source-model"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onChangeViewMode("source-model")}
          >
            {t("sourceModelView") ?? "来源+模型"}
          </button>
          <button
            type="button"
            className={cn(
              "px-3 py-1 rounded-md transition-all",
              viewMode === "channel"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onChangeViewMode("channel")}
          >
            {t("byChannel") ?? "按渠道"}
          </button>
          <button
            type="button"
            className={cn(
              "px-3 py-1 rounded-md transition-all",
              viewMode === "channel-model"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => onChangeViewMode("channel-model")}
          >
            {t("channelModelView") ?? "渠道+模型"}
          </button>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          {metricConfig.map((metric) => (
            <LegendPill
              key={metric.key}
              label={metric.label}
              color={metric.color}
              active={metrics[metric.key]}
              onClick={() => onToggleMetric(metric.key)}
            />
          ))}
        </div>
      </div>
      {legend && legend.type === "grouped" && (viewMode === "source-model" || viewMode === "channel-model") ? (
        <GroupedLegend
          groups={legend.groups}
          visibleSet={legend.visibleSet}
          onToggle={legend.onToggle}
          onToggleGroup={legend.onToggleGroup}
          total={legend.items.length}
        />
      ) : legend && legend.type !== "grouped" && (viewMode === "per-model" || viewMode === "source" || viewMode === "channel") ? (
        <DraggableLegend
          items={legend.items}
          visibleSet={legend.visibleSet}
          focusModels={"focusModels" in legend ? legend.focusModels : []}
          colorMap={legend.colorMap}
          onToggle={legend.onToggle}
          onReorder={(legend as { onReorder?: (fromId: string, toId: string) => void }).onReorder}
        />
      ) : null}
    </div>
  );
}
