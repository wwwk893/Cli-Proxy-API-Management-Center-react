"use client";

import { forwardRef, memo } from "react";
import { Area, Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { ChartTooltip } from "./chart-tooltip";
import type { ModelSeries, UsageChartMetricKey, UsageChartMetrics } from "../types";

type Props = {
  modelId: string;
  modelLabel?: string;
  sourceLabel?: string | null;
  data: ModelSeries["points"];
  totals: ModelSeries["totals"];
  metrics: UsageChartMetrics;
  modelColor: string;
  tokenColor: string;
  cacheColor: string;
  costColor: string;
  formatTick: (value: string) => string;
  focused: boolean;
  onToggleMetric: (key: UsageChartMetricKey) => void;
};

const currencyFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

function mapDataKeyToMetric(key: string): UsageChartMetricKey | null {
  if (key === "chartCachedTokens") return "cachedTokens";
  if (key === "chartComputedTokens") return "computedTokens";
  if (key === "costUsd") return "costUsd";
  return null;
}

export const ModelCard = memo(
  forwardRef<HTMLDivElement, Props>(function ModelCard(
    {
      modelId,
      modelLabel,
      sourceLabel,
      data,
      totals,
      metrics,
      modelColor,
      tokenColor,
      cacheColor,
      costColor,
      formatTick,
      focused,
      onToggleMetric,
    },
    ref,
  ) {
    if (!data.length) {
      return (
        <div ref={ref} className="rounded-lg border border-border/60 bg-muted/10 p-3 text-sm text-muted-foreground">
          <span className="font-mono text-xs text-card-foreground">{modelId}</span>
          <p className="mt-2 text-xs">No data</p>
        </div>
      );
    }

    const sanitizedId = modelId.replace(/[^a-zA-Z0-9]/g, "-");
    const cachedGradient = `cached-${sanitizedId}`;
    const computedGradient = `computed-${sanitizedId}`;

    return (
      <div
        ref={ref}
        className={cn(
          "rounded-lg border bg-muted/10 p-3 transition-shadow",
          focused ? "border-primary/60 shadow-[0_0_0_2px_rgba(34,211,238,0.2)]" : "border-border/60",
        )}
        style={{ boxShadow: focused ? "0 0 0 2px rgba(34,211,238,0.25)" : undefined }}
      >
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex flex-col gap-1">
            {sourceLabel ? (
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: modelColor }} />
                <span className="rounded-md border px-2 py-0.5 text-[10px] text-muted-foreground">
                  {sourceLabel}
                </span>
              </span>
            ) : (
              <span className="flex items-center gap-2 font-mono text-sm text-card-foreground">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: modelColor }} />
                {modelLabel ?? modelId}
              </span>
            )}
            {sourceLabel ? (
              <span className="flex items-center gap-2 font-mono text-sm text-card-foreground">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: modelColor }} />
                {modelLabel ?? modelId}
              </span>
            ) : null}
          </div>
          <div className="flex items-center gap-2 rounded-full bg-background/60 px-2 py-0.5 text-[10px]">
            {metrics.cachedTokens && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: cacheColor }} />
                Cache
              </span>
            )}
            {metrics.computedTokens && (
              <span className="flex items-center gap-1 text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tokenColor }} />
                Tokens
              </span>
            )}
            {metrics.costUsd && (
              <span className="flex items-center gap-1 text-foreground">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: costColor }} />
                {currencyFormatter.format(totals.costUsd)}
              </span>
            )}
          </div>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} syncId="per-model-detail">
              <defs>
                <linearGradient id={cachedGradient} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={cacheColor} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={cacheColor} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id={computedGradient} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={tokenColor} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={tokenColor} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#2f2f36" />
              <XAxis dataKey="bucket" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} minTickGap={18} tickFormatter={formatTick} />
              <YAxis
                yAxisId="tokens"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                scale="log"
                domain={[0.1, "auto"]}
                allowDataOverflow
                tickFormatter={(value) => `${Math.round((value as number) / 1000)}k`}
              />
              <YAxis
                yAxisId="cost"
                orientation="right"
                stroke={costColor}
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => `$${Number(value).toFixed(2)}`}
              />
              <Tooltip
                cursor={{ stroke: "rgba(255,255,255,0.15)", strokeWidth: 1 }}
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
              {metrics.cachedTokens && (
                <Area
                  yAxisId="tokens"
                  type="monotone"
                  dataKey="chartCachedTokens"
                  name="Cached"
                  fill={`url(#${cachedGradient})`}
                  stroke={cacheColor}
                  strokeWidth={1}
                  fillOpacity={1}
                />
              )}
              {metrics.computedTokens && (
                <Line
                  yAxisId="tokens"
                  type="monotone"
                  dataKey="chartComputedTokens"
                  name="Computed"
                  stroke={tokenColor}
                  strokeWidth={2.2}
                  dot={false}
                  activeDot={{ r: 3 }}
                />
              )}
              {metrics.costUsd && (
                <Bar
                  yAxisId="cost"
                  dataKey="costUsd"
                  name="Cost"
                  fill={costColor}
                  radius={[4, 4, 0, 0]}
                  barSize={10}
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  }),
);
