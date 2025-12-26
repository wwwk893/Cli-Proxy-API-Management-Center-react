import { useMemo } from "react";
import {
  buildChannelModelSeries,
  buildChannelSeries,
  buildModelSeries,
  buildSourceModelSeries,
  buildSourceSeries,
  normalizeAggregatePoints,
} from "../utils";
import {
  ModelSeries,
  PerChannelModelUsagePoint,
  PerChannelUsagePoint,
  PerModelUsagePoint,
  PerSourceUsagePoint,
  UsagePoint,
} from "../types";

export function useUsageSeries({
  aggregateData,
  perModelData,
  perSourceData,
  perChannelData,
  perChannelModelData,
  limitSourceModelSeries,
  limitChannelModelSeries,
}: {
  aggregateData: UsagePoint[] | null;
  perModelData: PerModelUsagePoint[] | null;
  perSourceData?: PerSourceUsagePoint[] | null;
  perChannelData?: PerChannelUsagePoint[] | null;
  perChannelModelData?: PerChannelModelUsagePoint[] | null;
  limitSourceModelSeries?: number;
  limitChannelModelSeries?: number;
}) {
  const aggregateSeries = useMemo(() => normalizeAggregatePoints(aggregateData), [aggregateData]);
  const modelSeries: ModelSeries[] = useMemo(() => buildModelSeries(perModelData), [perModelData]);
  const sourceSeries: ModelSeries[] = useMemo(() => buildSourceSeries(perSourceData ?? null), [perSourceData]);
  const sourceModelSeries: ModelSeries[] = useMemo(
    () => buildSourceModelSeries(perModelData, limitSourceModelSeries),
    [limitSourceModelSeries, perModelData],
  );
  const channelSeries: ModelSeries[] = useMemo(() => buildChannelSeries(perChannelData ?? null), [perChannelData]);
  const channelModelSeries: ModelSeries[] = useMemo(
    () => buildChannelModelSeries(perChannelModelData ?? null, limitChannelModelSeries),
    [limitChannelModelSeries, perChannelModelData],
  );

  return { aggregateSeries, modelSeries, sourceSeries, sourceModelSeries, channelSeries, channelModelSeries } as const;
}
