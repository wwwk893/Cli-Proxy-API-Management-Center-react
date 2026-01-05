import type { DateRange } from "react-day-picker";
import type { Granularity, ViewMode } from "@/components/charts/usage/types";
import { computePresetRange, parsePreset, presetRanges, type PresetKey } from "./presets";

export type UsageQueryState = {
  dateRange?: DateRange;
  activePreset: PresetKey | null;
  granularity: Granularity;
  viewMode: ViewMode;
  selectedModels: string[];
  selectedChannels: string[];
  selectedSources: string[];
  focusModels: string[];
  refreshKey: string | null;
};

export function parseFocusModels(params: URLSearchParams): string[] {
  const multi = params.getAll("focusModel");
  const single = params.get("focusModel");
  const values = multi.length ? multi : single ? [single] : [];
  return values
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}

export function arraysEqual(a: string[], b: string[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function readUsageSearchParams(params: URLSearchParams): UsageQueryState {
  const selectedModels = params.getAll("model").map((m) => m.trim()).filter(Boolean);
  const rawFocus = parseFocusModels(params);
  const focusModels = selectedModels.length
    ? rawFocus.filter((m) => selectedModels.includes(m))
    : rawFocus;

  const granularity = (params.get("granularity") as Granularity | null) ?? "day";
  const rawView = params.get("view")?.toLowerCase();
  const viewMode: ViewMode =
    rawView === "per-model"
      ? "per-model"
      : rawView === "source"
        ? "source"
        : rawView === "source-model"
          ? "source-model"
          : rawView === "channel"
            ? "channel"
            : rawView === "channel-model"
              ? "channel-model"
          : "aggregate";
  const activePreset = parsePreset(params.get("preset"));

  const selectedSources = params.getAll("sources").map((s) => s.trim()).filter(Boolean);
  const selectedChannelsRaw = params.getAll("channels").map((c) => c.trim()).filter(Boolean);
  const selectedChannels = selectedChannelsRaw.length ? selectedChannelsRaw : ["cliproxy", "codex", "opencode"];

  const fromStr = params.get("from");
  const toStr = params.get("to");
  const from = fromStr ? new Date(fromStr) : undefined;
  const to = toStr ? new Date(toStr) : undefined;
  const hasRange = (from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()));
  const dateRange = hasRange ? { from: from ?? undefined, to: to ?? undefined } : undefined;

  const refreshKey = params.get("r");

  return {
    dateRange,
    activePreset,
    granularity,
    viewMode,
    selectedModels,
    selectedChannels,
    selectedSources,
    focusModels,
    refreshKey,
  };
}

export function buildSearchParams(base: URLSearchParams, next: Partial<UsageQueryState>) {
  const params = new URLSearchParams(base.toString());

  // date range & preset
  if (next.dateRange) {
    if (next.dateRange.from) params.set("from", next.dateRange.from.toISOString());
    else params.delete("from");
    if (next.dateRange.to) params.set("to", next.dateRange.to.toISOString());
    else params.delete("to");
  }
  if (next.dateRange === undefined) {
    params.delete("from");
    params.delete("to");
  }
  if ("activePreset" in next) {
    if (next.activePreset) params.set("preset", next.activePreset);
    else params.delete("preset");
  }

  if (next.granularity) params.set("granularity", next.granularity);
  if (next.viewMode) params.set("view", next.viewMode);

  if (next.selectedModels) {
    params.delete("model");
    next.selectedModels.forEach((m) => params.append("model", m));
  }

  if (next.selectedSources) {
    params.delete("sources");
    next.selectedSources.forEach((s) => params.append("sources", s));
  }

  if (next.selectedChannels) {
    params.delete("channels");
    next.selectedChannels.forEach((c) => params.append("channels", c));
  }

  if (next.focusModels) {
    const serialized = next.focusModels.join(",");
    if (serialized) params.set("focusModel", serialized);
    else params.delete("focusModel");
  }

  if ("refreshKey" in next) {
    if (next.refreshKey) params.set("r", next.refreshKey);
    else params.delete("r");
  }

  return params;
}

export function applyPresetToParams(base: URLSearchParams, key: PresetKey | null) {
  const params = new URLSearchParams(base.toString());
  if (!key) {
    params.delete("preset");
    return params;
  }
  const range = computePresetRange(key);
  if (range?.from) params.set("from", range.from.toISOString());
  else params.delete("from");
  if (range?.to) params.set("to", range.to.toISOString());
  else params.delete("to");
  params.set("preset", key);
  return params;
}

export function shouldRefreshRangeForPreset(key: PresetKey | null) {
  return Boolean(key && presetRanges[key]);
}

// re-export for consumers
export { parsePreset, computePresetRange } from "./presets";
