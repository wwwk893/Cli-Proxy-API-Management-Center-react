import {
  ModelSeries,
  ModelSeriesPoint,
  PerChannelModelUsagePoint,
  PerChannelUsagePoint,
  PerModelUsagePoint,
  PerSourceUsagePoint,
  UsagePoint,
} from "./types";
import { formatSourceLabel } from "@/lib/source-utils";
import { formatChannelLabel } from "@/lib/channel-utils";

export function normalizeAggregatePoints(data: UsagePoint[] | null): ModelSeriesPoint[] {
  if (!data) return [];
  return data.map((point) => ({
    bucket: point.bucket ?? point.date ?? "",
    totalTokens: Number(point.totalTokens ?? 0),
    cachedTokens: Number(point.cachedTokens ?? 0),
    computedTokens: Math.max(0, Number(point.totalTokens ?? 0) - Number(point.cachedTokens ?? 0)),
    chartCachedTokens: Number(point.cachedTokens ?? 0),
    chartComputedTokens: Math.max(0, Number(point.totalTokens ?? 0) - Number(point.cachedTokens ?? 0)),
    costUsd: Number(point.costUsd ?? 0),
  }));
}

export function buildModelSeries(data: PerModelUsagePoint[] | null): ModelSeries[] {
  if (!data || !data.length) return [];

  const seriesMap = new Map<string, ModelSeries>();

  data.forEach((row) => {
    const bucket = row.bucket ?? row.date;
    if (!bucket) return;
    const modelId = row.model || "unknown";
    const totalTokens = Number(row.totalTokens ?? 0);
    const cachedTokens = Number(row.cachedTokens ?? 0);
    const computedTokens = Math.max(0, totalTokens - cachedTokens);
    const costUsd = Number(row.costUsd ?? 0);

    let series = seriesMap.get(modelId);
    if (!series) {
      series = {
        model: modelId,
        modelLabel: modelId,
        points: [],
        totals: {
          totalTokens: 0,
          cachedTokens: 0,
          costUsd: 0,
        },
      };
      seriesMap.set(modelId, series);
    }

    const safeCached = cachedTokens > 0 ? cachedTokens : 0.1;
    const safeComputed = computedTokens > 0 ? computedTokens : 0.1;

    series.points.push({
      bucket,
      totalTokens,
      cachedTokens,
      computedTokens,
      chartCachedTokens: safeCached,
      chartComputedTokens: safeComputed,
      costUsd,
    });

    series.totals.totalTokens += totalTokens;
    series.totals.cachedTokens += cachedTokens;
    series.totals.costUsd += costUsd;
  });

  return Array.from(seriesMap.values())
    .map((series) => ({
      ...series,
      points: series.points.sort((a, b) => new Date(a.bucket).getTime() - new Date(b.bucket).getTime()),
    }))
    .filter((series) => {
      const hasPoints = series.points.some(
        (point) =>
          point.totalTokens > 0 ||
          point.cachedTokens > 0 ||
          point.computedTokens > 0 ||
          point.costUsd > 0,
      );
      const hasTotals =
        series.totals.totalTokens > 0 ||
        series.totals.cachedTokens > 0 ||
        series.totals.costUsd > 0;
      return hasPoints || hasTotals;
    })
    .sort(compareModelSeries);
}

export function buildSourceSeries(data: PerSourceUsagePoint[] | null): ModelSeries[] {
  if (!data || !data.length) return [];

  const seriesMap = new Map<string, ModelSeries>();

  data.forEach((row) => {
    const bucket = row.bucket ?? row.date;
    if (!bucket) return;
    const sourceId = row.authSource ?? "unknown";
    const totalTokens = Number(row.totalTokens ?? 0);
    const cachedTokens = Number(row.cachedTokens ?? 0);
    const computedTokens = Math.max(0, totalTokens - cachedTokens);
    const costUsd = Number(row.costUsd ?? 0);

    let series = seriesMap.get(sourceId);
    if (!series) {
      series = {
        model: sourceId,
        sourceId,
        sourceLabel: formatSourceLabel(sourceId),
        points: [],
        totals: {
          totalTokens: 0,
          cachedTokens: 0,
          costUsd: 0,
        },
      };
      seriesMap.set(sourceId, series);
    }

    const safeCached = cachedTokens > 0 ? cachedTokens : 0.1;
    const safeComputed = computedTokens > 0 ? computedTokens : 0.1;

    series.points.push({
      bucket,
      totalTokens,
      cachedTokens,
      computedTokens,
      chartCachedTokens: safeCached,
      chartComputedTokens: safeComputed,
      costUsd,
    });

    series.totals.totalTokens += totalTokens;
    series.totals.cachedTokens += cachedTokens;
    series.totals.costUsd += costUsd;
  });

  return Array.from(seriesMap.values())
    .map((series) => ({
      ...series,
      points: series.points.sort((a, b) => new Date(a.bucket).getTime() - new Date(b.bucket).getTime()),
    }))
    .filter((series) => {
      const hasPoints = series.points.some(
        (point) => point.totalTokens > 0 || point.cachedTokens > 0 || point.computedTokens > 0 || point.costUsd > 0,
      );
      const hasTotals =
        series.totals.totalTokens > 0 || series.totals.cachedTokens > 0 || series.totals.costUsd > 0;
      return hasPoints || hasTotals;
    })
    .sort(compareModelSeries);
}

export function buildChannelSeries(data: PerChannelUsagePoint[] | null): ModelSeries[] {
  if (!data || !data.length) return [];

  const seriesMap = new Map<string, ModelSeries>();

  data.forEach((row) => {
    const bucket = row.bucket ?? row.date;
    if (!bucket) return;
    const channelId = row.channel || "unknown";
    const totalTokens = Number(row.totalTokens ?? 0);
    const cachedTokens = Number(row.cachedTokens ?? 0);
    const computedTokens = Math.max(0, totalTokens - cachedTokens);
    const costUsd = Number(row.costUsd ?? 0);

    let series = seriesMap.get(channelId);
    if (!series) {
      series = {
        model: channelId,
        sourceId: channelId,
        sourceLabel: formatChannelLabel(channelId),
        points: [],
        totals: {
          totalTokens: 0,
          cachedTokens: 0,
          costUsd: 0,
        },
      };
      seriesMap.set(channelId, series);
    }

    const safeCached = cachedTokens > 0 ? cachedTokens : 0.1;
    const safeComputed = computedTokens > 0 ? computedTokens : 0.1;

    series.points.push({
      bucket,
      totalTokens,
      cachedTokens,
      computedTokens,
      chartCachedTokens: safeCached,
      chartComputedTokens: safeComputed,
      costUsd,
    });

    series.totals.totalTokens += totalTokens;
    series.totals.cachedTokens += cachedTokens;
    series.totals.costUsd += costUsd;
  });

  return Array.from(seriesMap.values())
    .map((series) => ({
      ...series,
      points: series.points.sort((a, b) => new Date(a.bucket).getTime() - new Date(b.bucket).getTime()),
    }))
    .filter((series) => {
      const hasPoints = series.points.some(
        (point) => point.totalTokens > 0 || point.cachedTokens > 0 || point.computedTokens > 0 || point.costUsd > 0,
      );
      const hasTotals =
        series.totals.totalTokens > 0 || series.totals.cachedTokens > 0 || series.totals.costUsd > 0;
      return hasPoints || hasTotals;
    })
    .sort(compareModelSeries);
}

export function buildChannelModelSeries(data: PerChannelModelUsagePoint[] | null, limit?: number): ModelSeries[] {
  if (!data || !data.length) return [];

  const seriesMap = new Map<string, ModelSeries>();

  data.forEach((row) => {
    const bucket = row.bucket ?? row.date;
    if (!bucket) return;
    const channelId = row.channel || "unknown";
    const modelId = row.model || "unknown";
    const compositeId = `${channelId}::${modelId}`;
    const totalTokens = Number(row.totalTokens ?? 0);
    const cachedTokens = Number(row.cachedTokens ?? 0);
    const computedTokens = Math.max(0, totalTokens - cachedTokens);
    const costUsd = Number(row.costUsd ?? 0);

    let series = seriesMap.get(compositeId);
    if (!series) {
      series = {
        model: compositeId,
        modelLabel: modelId,
        sourceId: channelId,
        sourceLabel: formatChannelLabel(channelId),
        points: [],
        totals: {
          totalTokens: 0,
          cachedTokens: 0,
          costUsd: 0,
        },
      };
      seriesMap.set(compositeId, series);
    }

    const safeCached = cachedTokens > 0 ? cachedTokens : 0.1;
    const safeComputed = computedTokens > 0 ? computedTokens : 0.1;

    series.points.push({
      bucket,
      totalTokens,
      cachedTokens,
      computedTokens,
      chartCachedTokens: safeCached,
      chartComputedTokens: safeComputed,
      costUsd,
    });

    series.totals.totalTokens += totalTokens;
    series.totals.cachedTokens += cachedTokens;
    series.totals.costUsd += costUsd;
  });

  const built = Array.from(seriesMap.values())
    .map((series) => ({
      ...series,
      points: series.points.sort((a, b) => new Date(a.bucket).getTime() - new Date(b.bucket).getTime()),
    }))
    .filter((series) => {
      const hasPoints = series.points.some(
        (point) => point.totalTokens > 0 || point.cachedTokens > 0 || point.computedTokens > 0 || point.costUsd > 0,
      );
      const hasTotals =
        series.totals.totalTokens > 0 || series.totals.cachedTokens > 0 || series.totals.costUsd > 0;
      return hasPoints || hasTotals;
    })
    .sort((a, b) => {
      const costDiff = Number(b.totals.costUsd ?? 0) - Number(a.totals.costUsd ?? 0);
      if (costDiff !== 0) return costDiff;
      const totalDiff = Number(b.totals.totalTokens ?? 0) - Number(a.totals.totalTokens ?? 0);
      if (totalDiff !== 0) return totalDiff;
      return (a.sourceLabel ?? "").localeCompare(b.sourceLabel ?? "") || a.model.localeCompare(b.model);
    });

  if (limit && limit > 0 && built.length > limit) {
    return built.slice(0, limit);
  }

  return built;
}

export function buildSourceModelSeries(data: PerModelUsagePoint[] | null, limit?: number): ModelSeries[] {
  if (!data || !data.length) return [];

  const seriesMap = new Map<string, ModelSeries>();

  data.forEach((row) => {
    const bucket = row.bucket ?? row.date;
    if (!bucket) return;
    const sourceId = row.authSource ?? "unknown";
    const modelId = row.model || "unknown";
    const compositeId = `${sourceId}::${modelId}`;
    const totalTokens = Number(row.totalTokens ?? 0);
    const cachedTokens = Number(row.cachedTokens ?? 0);
    const computedTokens = Math.max(0, totalTokens - cachedTokens);
    const costUsd = Number(row.costUsd ?? 0);

    let series = seriesMap.get(compositeId);
    if (!series) {
      series = {
        model: compositeId,
        modelLabel: modelId,
        sourceId,
        sourceLabel: formatSourceLabel(sourceId),
        points: [],
        totals: {
          totalTokens: 0,
          cachedTokens: 0,
          costUsd: 0,
        },
      };
      seriesMap.set(compositeId, series);
    }

    const safeCached = cachedTokens > 0 ? cachedTokens : 0.1;
    const safeComputed = computedTokens > 0 ? computedTokens : 0.1;

    series.points.push({
      bucket,
      totalTokens,
      cachedTokens,
      computedTokens,
      chartCachedTokens: safeCached,
      chartComputedTokens: safeComputed,
      costUsd,
    });

    series.totals.totalTokens += totalTokens;
    series.totals.cachedTokens += cachedTokens;
    series.totals.costUsd += costUsd;
  });

  const built = Array.from(seriesMap.values())
    .map((series) => ({
      ...series,
      points: series.points.sort((a, b) => new Date(a.bucket).getTime() - new Date(b.bucket).getTime()),
    }))
    .filter((series) => {
      const hasPoints = series.points.some(
        (point) => point.totalTokens > 0 || point.cachedTokens > 0 || point.computedTokens > 0 || point.costUsd > 0,
      );
      const hasTotals =
        series.totals.totalTokens > 0 || series.totals.cachedTokens > 0 || series.totals.costUsd > 0;
      return hasPoints || hasTotals;
    })
    .sort((a, b) => {
      const costDiff = Number(b.totals.costUsd ?? 0) - Number(a.totals.costUsd ?? 0);
      if (costDiff !== 0) return costDiff;
      const totalDiff = Number(b.totals.totalTokens ?? 0) - Number(a.totals.totalTokens ?? 0);
      if (totalDiff !== 0) return totalDiff;
      return (a.sourceLabel ?? "").localeCompare(b.sourceLabel ?? "") || a.model.localeCompare(b.model);
    });

  if (limit && limit > 0 && built.length > limit) {
    return built.slice(0, limit);
  }

  return built;
}

function compareModelSeries(a: ModelSeries, b: ModelSeries) {
  const totalDiff = Number(b.totals.totalTokens ?? 0) - Number(a.totals.totalTokens ?? 0);
  if (totalDiff !== 0) return totalDiff;

  const rateA = a.totals.totalTokens > 0 ? a.totals.cachedTokens / a.totals.totalTokens : 0;
  const rateB = b.totals.totalTokens > 0 ? b.totals.cachedTokens / b.totals.totalTokens : 0;
  const rateDiff = rateB - rateA;
  if (rateDiff !== 0) return rateDiff;

  const costDiff = Number(b.totals.costUsd ?? 0) - Number(a.totals.costUsd ?? 0);
  if (costDiff !== 0) return costDiff;

  return a.model.localeCompare(b.model);
}

export function dedupeModels(models?: string[] | null) {
  if (!models?.length) return [] as string[];
  const unique = new Set(models.map((model) => model.trim()).filter(Boolean));
  return Array.from(unique);
}
