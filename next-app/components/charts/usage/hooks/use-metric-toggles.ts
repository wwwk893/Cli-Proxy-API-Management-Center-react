import { useMemo, useState } from "react";
import { UsageChartMetricKey, UsageChartMetrics } from "../types";

export type MetricDefinition = {
  key: UsageChartMetricKey;
  color: string;
  label: string;
};

const METRIC_COLORS: Record<UsageChartMetricKey, string> = {
  computedTokens: "var(--chart-1)",
  cachedTokens: "var(--chart-2)",
  costUsd: "var(--chart-3)",
};

export function useMetricToggles(labels: Record<UsageChartMetricKey, string>) {
  const [metrics, setMetrics] = useState<UsageChartMetrics>({
    computedTokens: true,
    cachedTokens: true,
    costUsd: true,
  });

  const metricConfig = useMemo(() => {
    return (Object.keys(metrics) as UsageChartMetricKey[]).map((key) => ({
      key,
      color: METRIC_COLORS[key],
      label: labels[key],
    }));
  }, [labels, metrics]);

  const toggleMetric = (key: UsageChartMetricKey) => {
    setMetrics((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  return { metrics, metricConfig, toggleMetric } as const;
}
