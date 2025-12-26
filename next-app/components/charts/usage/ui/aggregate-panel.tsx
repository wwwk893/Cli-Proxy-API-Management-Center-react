"use client";

import { Area, Bar, BarChart, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { ChartTooltip } from "./chart-tooltip";
import type { UsageChartMetricKey, UsageChartMetrics } from "../types";

type ChartPoint = {
  bucket: string;
  cachedTokens: number;
  computedTokens: number;
  costUsd: number;
};

type Props = {
  data: ChartPoint[];
  metrics: UsageChartMetrics;
  metricConfig: { key: UsageChartMetricKey; color: string; label: string }[];
  formatTick: (value: string) => string;
  chartSyncId: string;
  showSkeleton: boolean;
  error?: string | null;
  onToggleMetric: (key: UsageChartMetricKey) => void;
};

function mapDataKeyToMetric(key: string): UsageChartMetricKey | null {
  if (key === "cachedTokens") return "cachedTokens";
  if (key === "computedTokens") return "computedTokens";
  if (key === "costUsd") return "costUsd";
  return null;
}

export function AggregatePanel({ data, metrics, metricConfig, formatTick, chartSyncId, showSkeleton, error, onToggleMetric }: Props) {
  if (showSkeleton) {
    return <Skeleton className="h-80" />;
  }

  const cachedConfig = metricConfig.find((metric) => metric.key === "cachedTokens");
  const computedConfig = metricConfig.find((metric) => metric.key === "computedTokens");
  const costConfig = metricConfig.find((metric) => metric.key === "costUsd");

  return (
    <>
      {error ? <div className="text-sm text-destructive">{error}</div> : null}
      <div className="h-[210px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} syncId={chartSyncId}>
            <defs>
              <linearGradient id="colorCached" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={cachedConfig?.color ?? "var(--chart-2)"} stopOpacity={0.45} />
                <stop offset="95%" stopColor={cachedConfig?.color ?? "var(--chart-2)"} stopOpacity={0.05} />
              </linearGradient>
              <linearGradient id="colorComputed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={computedConfig?.color ?? "var(--chart-1)"} stopOpacity={0.45} />
                <stop offset="95%" stopColor={computedConfig?.color ?? "var(--chart-1)"} stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#2f2f36" />
            <XAxis dataKey="bucket" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} minTickGap={28} tickFormatter={formatTick} />
            <YAxis stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${Math.round((value as number) / 1000)}k`} />
            <Tooltip
              cursor={{ stroke: "rgba(255,255,255,0.1)", strokeWidth: 1 }}
              wrapperStyle={{ pointerEvents: "auto" }}
              content={(
                <ChartTooltip
                  labelFormatter={formatTick}
                  onToggleSeries={(key) => {
                    const metricKey = mapDataKeyToMetric(key);
                    if (metricKey) onToggleMetric(metricKey);
                  }}
                  isActiveSeries={(key) => {
                    const metricKey = mapDataKeyToMetric(key);
                    return metricKey ? metrics[metricKey] : true;
                  }}
                />
              )}
            />
            {metrics.cachedTokens ? (
              <Area type="monotone" dataKey="cachedTokens" stackId="1" name={cachedConfig?.label ?? "Cached"} fill="url(#colorCached)" stroke={cachedConfig?.color ?? "var(--chart-2)"} strokeWidth={1.6} />
            ) : null}
            {metrics.computedTokens ? (
              <Area type="monotone" dataKey="computedTokens" stackId="1" name={computedConfig?.label ?? "Computed"} fill="url(#colorComputed)" stroke={computedConfig?.color ?? "var(--chart-1)"} strokeWidth={1.6} />
            ) : null}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <div className="h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} syncId={chartSyncId}>
            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#2f2f36" />
            <XAxis dataKey="bucket" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} minTickGap={28} tickFormatter={formatTick} />
            <YAxis stroke={costConfig?.color ?? "var(--chart-3)"} fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `$${value}`} />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.05)" }}
              wrapperStyle={{ pointerEvents: "auto" }}
              content={(
                <ChartTooltip
                  labelFormatter={formatTick}
                  onToggleSeries={(key) => {
                    const metricKey = mapDataKeyToMetric(key);
                    if (metricKey) onToggleMetric(metricKey);
                  }}
                  isActiveSeries={(key) => {
                    const metricKey = mapDataKeyToMetric(key);
                    return metricKey ? metrics[metricKey] : true;
                  }}
                />
              )}
            />
            {metrics.costUsd ? (
              <Bar dataKey="costUsd" name={costConfig?.label ?? "Cost"} fill={costConfig?.color ?? "var(--chart-3)"} radius={[4, 4, 0, 0]} />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
