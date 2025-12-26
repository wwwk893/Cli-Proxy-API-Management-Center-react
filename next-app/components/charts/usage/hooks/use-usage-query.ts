import { useEffect, useMemo, useState } from "react";
import {
  PerChannelModelUsagePoint,
  PerChannelUsagePoint,
  PerModelUsagePoint,
  PerSourceUsagePoint,
  UsagePoint,
  UsageQueryParams,
} from "../types";
import { dedupeModels } from "../utils";
import { useUsageFilters } from "@/lib/usage/usage-filters-context";

export function useUsageQuery({ filterModels, viewMode, granularity, from, to, refreshKey, sources = [], dimension }: UsageQueryParams) {
  const {
    state: { selectedChannels },
    actions: { beginRefresh, endRefresh },
  } = useUsageFilters();
  const normalizedFilterModels = useMemo(() => dedupeModels(filterModels), [filterModels]);
  const normalizedSources = useMemo(() => dedupeModels(sources), [sources]);
  const normalizedChannels = useMemo(() => dedupeModels(selectedChannels), [selectedChannels]);
  const [aggregateData, setAggregateData] = useState<UsagePoint[] | null>(null);
  const [perModelData, setPerModelData] = useState<PerModelUsagePoint[] | null>(null);
  const [perSourceData, setPerSourceData] = useState<PerSourceUsagePoint[] | null>(null);
  const [perChannelData, setPerChannelData] = useState<PerChannelUsagePoint[] | null>(null);
  const [perChannelModelData, setPerChannelModelData] = useState<PerChannelModelUsagePoint[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoadedAggregate, setHasLoadedAggregate] = useState(false);
  const [hasLoadedPerModel, setHasLoadedPerModel] = useState(false);
  const [hasLoadedSource, setHasLoadedSource] = useState(false);
  const [hasLoadedChannel, setHasLoadedChannel] = useState(false);
  const [hasLoadedChannelModel, setHasLoadedChannelModel] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let completed = false;
    const fetchUsage = async () => {
      setIsLoading(true);
      beginRefresh();
      const params = new URLSearchParams();
      normalizedFilterModels.forEach((model) => params.append("model", model));
      normalizedSources.forEach((source) => params.append("sources", source));
      normalizedChannels.forEach((channel) => params.append("channels", channel));
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      params.set("view", viewMode);
      params.set("granularity", granularity);
      const requestDimension = dimension
        ?? (viewMode === "aggregate"
          ? "overall"
          : viewMode === "source"
            ? "source"
            : viewMode === "source-model"
              ? "model+source"
              : viewMode === "channel"
                ? "channel"
                : viewMode === "channel-model"
                  ? "model+channel"
              : "model");
      params.set("dimension", requestDimension);
      if (refreshKey) params.set("r", refreshKey);
      const query = params.toString();
      try {
        const res = await fetch(`/api/usage${query ? `?${query}` : ""}`, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`${res.status} ${res.statusText}`);
        }
        const json = await res.json();
        if (requestDimension === "model") {
          const rows = (json.data ?? []) as PerModelUsagePoint[];
          if (viewMode === "per-model") setPerModelData(rows);
          else setAggregateData(rows as UsagePoint[]);
          setHasLoadedPerModel(true);
        } else if (requestDimension === "source") {
          const rows = (json.data ?? []) as PerSourceUsagePoint[];
          setPerSourceData(rows);
          setHasLoadedSource(true);
        } else if (requestDimension === "channel") {
          const rows = (json.data ?? []) as PerChannelUsagePoint[];
          setPerChannelData(rows);
          setHasLoadedChannel(true);
        } else if (requestDimension === "model+channel") {
          const rows = (json.data ?? []) as PerChannelModelUsagePoint[];
          setPerChannelModelData(rows);
          setHasLoadedChannelModel(true);
        } else if (requestDimension === "overall") {
          const rows = (json.data ?? []) as UsagePoint[];
          setAggregateData(rows);
          setHasLoadedAggregate(true);
        } else {
          // model+source fallback: treat like per-model
          const rows = (json.data ?? []) as PerModelUsagePoint[];
          setPerModelData(rows);
          setHasLoadedPerModel(true);
        }
        setError(null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        if (viewMode === "per-model" || viewMode === "source-model") setPerModelData([]);
        if (viewMode === "aggregate") setAggregateData([]);
        if (viewMode === "source") setPerSourceData([]);
        if (viewMode === "channel") setPerChannelData([]);
        if (viewMode === "channel-model") setPerChannelModelData([]);
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          endRefresh();
          completed = true;
        }
      }
    };

    fetchUsage();
    return () => {
      controller.abort();
      if (!completed) endRefresh();
    };
  }, [beginRefresh, dimension, endRefresh, from, granularity, normalizedChannels, normalizedFilterModels, normalizedSources, refreshKey, to, viewMode]);

  return {
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
  } as const;
}
