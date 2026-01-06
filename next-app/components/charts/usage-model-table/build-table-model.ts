"use client";

import { EFFORT_LEVELS, type EffortFilterValue, type EffortLevel, type EffortOrNull, type UsageModelGroupBy } from "@/lib/usage/model-normalize";
import type { UsageByModelRow } from "@/app/api/usage/by-model/types";
import type { BuildTableModelParams, CanonicalNode, EffortDistribution, EffortNode, Metrics, SourceNode, TableViewModel } from "./types";

function sumNullable(current: number | null, next: number | null) {
  if (current === null || next === null) return null;
  return current + next;
}

function effortToFilterValue(value: EffortOrNull): EffortFilterValue {
  return value ?? "unspecified";
}

function normalizeEffortFilter(values: EffortFilterValue[]) {
  const set = new Set<EffortFilterValue>();
  values.forEach((value) => {
    if (value === "unspecified" || (EFFORT_LEVELS as readonly string[]).includes(value)) {
      set.add(value);
    }
  });
  return set;
}

function applyEffortFilter(rows: UsageByModelRow[], effortFilter: EffortFilterValue[]) {
  const set = normalizeEffortFilter(effortFilter);
  if (set.size === 0) return rows;
  return rows.filter((row) => set.has(effortToFilterValue(row.effort)));
}

function buildMetrics(rows: UsageByModelRow[]): Metrics {
  const result: Metrics = {
    requestCount: 0,
    failureCount: 0,
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    cachedTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    inputCostUsd: 0,
    outputCostUsd: 0,
    cachedCostUsd: 0,
    pricingConfigured: true,
    pricingConflict: false,
    cacheHitRate: 0,
  };

  rows.forEach((row) => {
    result.requestCount += Number(row.requestCount ?? 0);
    result.failureCount += Number(row.failureCount ?? 0);
    result.inputTokens += Number(row.inputTokens ?? 0);
    result.outputTokens += Number(row.outputTokens ?? 0);
    result.reasoningTokens += Number(row.reasoningTokens ?? 0);
    result.cachedTokens += Number(row.cachedTokens ?? 0);
    result.totalTokens += Number(row.totalTokens ?? 0);
    result.costUsd += Number(row.costUsd ?? 0);
    result.inputCostUsd = sumNullable(result.inputCostUsd, row.inputCostUsd);
    result.outputCostUsd = sumNullable(result.outputCostUsd, row.outputCostUsd);
    result.cachedCostUsd = sumNullable(result.cachedCostUsd, row.cachedCostUsd);
    result.pricingConfigured = result.pricingConfigured && Boolean(row.pricingConfigured);
    result.pricingConflict = result.pricingConflict || Boolean(row.pricingConflict);
  });

  const safeTotal = Number(result.totalTokens ?? 0);
  const safeCached = Number(result.cachedTokens ?? 0);
  result.cacheHitRate = safeTotal > 0 ? safeCached / safeTotal : 0;
  return result;
}

function normalizeDistributionToShares(distribution: Record<EffortLevel | "unspecified", number>): EffortDistribution {
  const total = Object.values(distribution).reduce((acc, value) => acc + Number(value ?? 0), 0);
  if (!Number.isFinite(total) || total <= 0) {
    return {
      low: 0,
      medium: 0,
      high: 0,
      xhigh: 0,
      unspecified: 0,
    };
  }

  return {
    low: distribution.low / total,
    medium: distribution.medium / total,
    high: distribution.high / total,
    xhigh: distribution.xhigh / total,
    unspecified: distribution.unspecified / total,
  };
}

function groupSources(params: { rows: UsageByModelRow[]; canonical: string; effort: EffortOrNull }) {
  const { rows, canonical, effort } = params;
  const map = new Map<string, UsageByModelRow[]>();
  rows.forEach((row) => {
    const key = row.authSource ?? "";
    const existing = map.get(key) ?? [];
    existing.push(row);
    map.set(key, existing);
  });

  const sources: SourceNode[] = Array.from(map.entries())
    .map(([authSourceKey, list]) => {
      const authSource = authSourceKey === "" ? null : authSourceKey;
      return {
        kind: "source",
        key: `s:${canonical}|e:${effortToFilterValue(effort)}|src:${authSource ?? ""}`,
        authSource,
        metrics: buildMetrics(list),
      };
    })
    .sort((a, b) => {
      const costDiff = b.metrics.costUsd - a.metrics.costUsd;
      if (costDiff !== 0) return costDiff;
      return b.metrics.totalTokens - a.metrics.totalTokens;
    });

  return sources;
}

function buildCanonicalModel(dataLeafRows: UsageByModelRow[], effortFilter: EffortFilterValue[]): CanonicalNode[] {
  const leaf = applyEffortFilter(dataLeafRows, effortFilter);
  const byCanonical = new Map<string, UsageByModelRow[]>();

  leaf.forEach((row) => {
    const canonical = row.modelCanonical ?? row.model;
    const existing = byCanonical.get(canonical) ?? [];
    existing.push(row);
    byCanonical.set(canonical, existing);
  });

  const nodes: CanonicalNode[] = Array.from(byCanonical.entries()).map(([canonical, rows]) => {
    const byEffort = new Map<EffortFilterValue, UsageByModelRow[]>();
    rows.forEach((row) => {
      const key = effortToFilterValue(row.effort);
      const existing = byEffort.get(key) ?? [];
      existing.push(row);
      byEffort.set(key, existing);
    });

    const distributionRaw: Record<EffortLevel | "unspecified", number> = {
      low: 0,
      medium: 0,
      high: 0,
      xhigh: 0,
      unspecified: 0,
    };

    const efforts: EffortNode[] = Array.from(byEffort.entries())
      .map(([effortKey, list]) => {
        const effort: EffortOrNull = effortKey === "unspecified" ? null : (effortKey as EffortLevel);
        const metrics = buildMetrics(list);
        distributionRaw[effortKey] = metrics.totalTokens;
        return {
          kind: "effort",
          key: `e:${canonical}|${effortKey}`,
          effort,
          label: effortKey,
          metrics,
          sources: groupSources({ rows: list, canonical, effort }),
        };
      })
      .sort((a, b) => {
        if (a.label === "unspecified" && b.label !== "unspecified") return 1;
        if (b.label === "unspecified" && a.label !== "unspecified") return -1;
        const costDiff = b.metrics.costUsd - a.metrics.costUsd;
        if (costDiff !== 0) return costDiff;
        return b.metrics.totalTokens - a.metrics.totalTokens;
      });

    return {
      kind: "canonical",
      key: `c:${canonical}`,
      modelCanonical: canonical,
      metrics: buildMetrics(rows),
      distribution: normalizeDistributionToShares(distributionRaw),
      efforts,
    };
  });

  return nodes.sort((a, b) => {
    const costDiff = b.metrics.costUsd - a.metrics.costUsd;
    if (costDiff !== 0) return costDiff;
    return b.metrics.totalTokens - a.metrics.totalTokens;
  });
}

function buildCanonicalEffortRows(dataLeafRows: UsageByModelRow[], effortFilter: EffortFilterValue[]) {
  const leaf = applyEffortFilter(dataLeafRows, effortFilter);
  const map = new Map<string, UsageByModelRow[]>();

  leaf.forEach((row) => {
    const canonical = row.modelCanonical ?? row.model;
    const effortKey = effortToFilterValue(row.effort);
    const key = `${canonical}::${effortKey}`;
    const existing = map.get(key) ?? [];
    existing.push(row);
    map.set(key, existing);
  });

  const rows = Array.from(map.entries())
    .map(([key, list]) => {
      const first = list[0];
      const canonical = first.modelCanonical ?? first.model;
      const effortKey = effortToFilterValue(first.effort);
      const effort: EffortOrNull = effortKey === "unspecified" ? null : (effortKey as EffortLevel);
      return {
        key: `ce:${canonical}|${effortKey}`,
        modelCanonical: canonical,
        effort,
        metrics: buildMetrics(list),
        sources: groupSources({ rows: list, canonical, effort }),
      };
    })
    .sort((a, b) => {
      const costDiff = b.metrics.costUsd - a.metrics.costUsd;
      if (costDiff !== 0) return costDiff;
      return b.metrics.totalTokens - a.metrics.totalTokens;
    });

  return rows;
}

function buildRawRows(dataLeafRows: UsageByModelRow[]) {
  const map = new Map<string, UsageByModelRow[]>();
  dataLeafRows.forEach((row) => {
    const raw = row.modelRaw ?? row.model;
    const existing = map.get(raw) ?? [];
    existing.push(row);
    map.set(raw, existing);
  });

  const rows = Array.from(map.entries())
    .map(([raw, list]) => {
      const first = list[0];
      return {
        key: `r:${raw}`,
        modelRaw: raw,
        modelCanonical: first.modelCanonical ?? null,
        effort: first.effort,
        metrics: buildMetrics(list),
        sources: groupSources({ rows: list, canonical: raw, effort: first.effort }),
      };
    })
    .sort((a, b) => {
      const costDiff = b.metrics.costUsd - a.metrics.costUsd;
      if (costDiff !== 0) return costDiff;
      return b.metrics.totalTokens - a.metrics.totalTokens;
    });

  return rows;
}

export function buildTableModel(params: BuildTableModelParams): TableViewModel {
  const { groupBy, data, effortFilter } = params;

  if (groupBy === "raw") {
    return { groupBy: "raw", rows: buildRawRows(data) };
  }

  if (groupBy === "canonical_effort") {
    return { groupBy: "canonical_effort", rows: buildCanonicalEffortRows(data, effortFilter) };
  }

  return { groupBy: "canonical", nodes: buildCanonicalModel(data, effortFilter) };
}

export type { UsageModelGroupBy };

