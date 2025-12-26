"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { DateRange } from "react-day-picker";
import type { Granularity, ViewMode } from "@/components/charts/usage/types";
import { applyPresetToParams, computePresetRange, readUsageSearchParams } from "../url-state";
import type { PresetKey } from "../presets";

export type UsageUrlActions = {
  setDateRange: (range?: DateRange | null) => void;
  setPreset: (key: PresetKey | null) => void;
  setGranularity: (g: Granularity) => void;
  setViewMode: (mode: ViewMode) => void;
  setSelectedModels: (models: string[]) => void;
  setSelectedChannels: (channels: string[]) => void;
  setSelectedSources: (sources: string[]) => void;
  toggleFocusModel: (model: string) => void;
  setFocusModels: (models: string[]) => void;
  refreshWithPreset: () => void;
};

export function useUsageParams() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const state = useMemo(() => readUsageSearchParams(searchParams), [searchParams]);

  const replaceParams = useCallback(
    (updater: (params: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      updater(next);
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const setDateRange = useCallback(
    (range?: DateRange | null) => {
      replaceParams((params) => {
        params.delete("preset");
        if (range?.from) params.set("from", range.from.toISOString());
        else params.delete("from");
        if (range?.to) params.set("to", range.to.toISOString());
        else params.delete("to");
      });
    },
    [replaceParams],
  );

  const setPreset = useCallback(
    (key: PresetKey | null) => {
      replaceParams((params) => {
        const next = applyPresetToParams(params, key);
        const existingKeys = Array.from(params.keys());
        existingKeys.forEach((k) => params.delete(k));
        next.forEach((value, k) => params.append(k, value));
      });
    },
    [replaceParams],
  );

  const setGranularity = useCallback(
    (g: Granularity) => {
      replaceParams((params) => {
        params.set("granularity", g);
      });
    },
    [replaceParams],
  );

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      replaceParams((params) => {
        params.set("view", mode);
      });
    },
    [replaceParams],
  );

  const setSelectedModels = useCallback(
    (models: string[]) => {
      const unique = Array.from(new Set(models.map((m) => m.trim()).filter(Boolean)));
      replaceParams((params) => {
        params.delete("model");
        unique.forEach((m) => params.append("model", m));

        // align focus models to selected models if any
        if (unique.length) {
          const currentFocus = params.get("focusModel")?.split(",").filter(Boolean) ?? [];
          const filtered = currentFocus.filter((m) => unique.includes(m));
          if (filtered.length) params.set("focusModel", filtered.join(","));
          else params.delete("focusModel");
        }
      });
    },
    [replaceParams],
  );

  const setSelectedSources = useCallback(
    (sources: string[]) => {
      const unique = Array.from(new Set(sources.map((s) => s.trim()).filter(Boolean)));
      replaceParams((params) => {
        params.delete("sources");
        unique.forEach((s) => params.append("sources", s));
      });
    },
    [replaceParams],
  );

  const setSelectedChannels = useCallback(
    (channels: string[]) => {
      const unique = Array.from(new Set(channels.map((c) => c.trim()).filter(Boolean)));
      replaceParams((params) => {
        params.delete("channels");
        if (unique.length) {
          unique.forEach((c) => params.append("channels", c));
        }
      });
    },
    [replaceParams],
  );

  const setFocusModels = useCallback(
    (models: string[]) => {
      const unique = Array.from(new Set(models.map((m) => m.trim()).filter(Boolean)));
      replaceParams((params) => {
        const serialized = unique.join(",");
        if (serialized) params.set("focusModel", serialized);
        else params.delete("focusModel");
      });
    },
    [replaceParams],
  );

  const toggleFocusModel = useCallback(
    (model: string) => {
      const current = state.focusModels;
      const next = current.includes(model) ? current.filter((m) => m !== model) : [...current, model];
      setFocusModels(next);
    },
    [setFocusModels, state.focusModels],
  );

  const refreshWithPreset = useCallback(() => {
    const stamp = Date.now().toString();
    const preset = state.activePreset;
    if (preset) {
      replaceParams((params) => {
        const range = computePresetRange(preset, new Date());
        params.set("preset", preset);
        if (range?.from) params.set("from", range.from.toISOString());
        else params.delete("from");
        if (range?.to) params.set("to", range.to.toISOString());
        else params.delete("to");
        params.set("r", stamp);
      });
      return;
    }
    replaceParams((params) => {
      params.set("r", stamp);
    });
  }, [replaceParams, state.activePreset]);

  const actions: UsageUrlActions = {
    setDateRange,
    setPreset,
    setGranularity,
    setViewMode,
    setSelectedModels,
    setSelectedChannels,
    setSelectedSources,
    toggleFocusModel,
    setFocusModels,
    refreshWithPreset,
  };

  return { state, actions } as const;
}
