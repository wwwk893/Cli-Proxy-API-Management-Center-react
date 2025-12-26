import { useEffect, useMemo, useState } from "react";
import { ModelSeries } from "../types";

type Params = {
  series: ModelSeries[];
  filterModels: string[];
  focusModels: string[];
};

export function useChartLegend({ series, filterModels, focusModels }: Params) {
  const [visibleModels, setVisibleModels] = useState<string[]>([]);
  const [modelOrder, setModelOrder] = useState<string[]>([]);

  const modelIdsForLegend = useMemo(() => {
    const ids = series.map((item) => item.model);
    if (!ids.length) return [] as string[];
    if (!filterModels.length) return ids;
    const filterSet = new Set(filterModels);
    const filtered = ids.filter((id) => filterSet.has(id));
    return filtered.length ? filtered : ids;
  }, [series, filterModels]);

  const orderedLegendModels = useMemo(() => {
    if (!modelIdsForLegend.length) return [] as string[];
    const filtered = modelOrder.filter((id) => modelIdsForLegend.includes(id));
    const missing = modelIdsForLegend.filter((id) => !filtered.includes(id));
    return [...filtered, ...missing];
  }, [modelOrder, modelIdsForLegend]);

  // reset visibility/order when the underlying series set changes
  const legendKey = modelIdsForLegend.join("|");
  useEffect(() => {
    // defer reset to avoid synchronous setState warning
    const allIds = new Set(modelIdsForLegend);
    const handle = requestAnimationFrame(() => {
      setVisibleModels((prev) => (prev.every((id) => allIds.has(id)) ? prev : []));
      setModelOrder((prev) => (prev.every((id) => allIds.has(id)) ? prev : []));
    });
    return () => cancelAnimationFrame(handle);
  }, [legendKey, modelIdsForLegend]);

  const orderedVisibleModels = useMemo(() => {
    if (!orderedLegendModels.length) return [] as string[];
    const userVisibleSet = new Set(visibleModels);
    const focusOrderedIds = focusModels.filter((id) => orderedLegendModels.includes(id));
    const focusSet = new Set(focusOrderedIds);

    let base: string[];
    if (userVisibleSet.size > 0) {
      base = orderedLegendModels.filter((id) => userVisibleSet.has(id) || focusSet.has(id));
    } else {
      base = orderedLegendModels;
    }

    if (focusSet.size === 0) {
      return base;
    }

    const focusFirst = focusOrderedIds.filter((id) => base.includes(id));
    const rest = base.filter((id) => !focusSet.has(id));
    return focusFirst.length ? [...focusFirst, ...rest] : base;
  }, [orderedLegendModels, visibleModels, focusModels]);

  const visibleModelSet = useMemo(() => new Set(visibleModels), [visibleModels]);

  const handleLegendToggle = (id: string) => {
    setVisibleModels((prev) => {
      if (prev.length === 0) return [id];
      if (prev.includes(id)) return prev.filter((value) => value !== id);
      return [...prev, id];
    });
  };

  const handleLegendReorder = (fromId: string, toId: string) => {
    setModelOrder((prev) => {
      if (fromId === toId) return prev;
      const working = [...orderedLegendModels];
      const fromIndex = working.indexOf(fromId);
      const toIndex = working.indexOf(toId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const next = [...working];
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, fromId);
      return next;
    });
  };

  return {
    modelIdsForLegend,
    orderedLegendModels,
    orderedVisibleModels,
    visibleModelSet,
    visibleModels,
    setVisibleModels,
    handleLegendToggle,
    handleLegendReorder,
  } as const;
}
