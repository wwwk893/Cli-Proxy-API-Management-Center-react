import { subDays, subHours, subMinutes, subMonths, subYears } from "date-fns";
import type { DateRange } from "react-day-picker";

export type PresetKey =
  | "last_15m"
  | "last_30m"
  | "last_1h"
  | "last_1d"
  | "last_3d"
  | "last_7d"
  | "last_15d"
  | "last_1m"
  | "last_3m"
  | "last_6m"
  | "last_1y";

export const presetOptions: { key: PresetKey; labelKey: string }[] = [
  { key: "last_15m", labelKey: "last15Minutes" },
  { key: "last_30m", labelKey: "last30Minutes" },
  { key: "last_1h", labelKey: "last1Hour" },
  { key: "last_1d", labelKey: "last1Day" },
  { key: "last_3d", labelKey: "last3Days" },
  { key: "last_7d", labelKey: "last7Days" },
  { key: "last_15d", labelKey: "last15Days" },
  { key: "last_1m", labelKey: "last1Month" },
  { key: "last_3m", labelKey: "last3Months" },
  { key: "last_6m", labelKey: "last6Months" },
  { key: "last_1y", labelKey: "last1Year" },
];

export const presetRanges: Record<PresetKey, (base: Date) => DateRange> = {
  last_15m: (base) => ({ from: subMinutes(base, 15), to: base }),
  last_30m: (base) => ({ from: subMinutes(base, 30), to: base }),
  last_1h: (base) => ({ from: subHours(base, 1), to: base }),
  last_1d: (base) => ({ from: subDays(base, 1), to: base }),
  last_3d: (base) => ({ from: subDays(base, 3), to: base }),
  last_7d: (base) => ({ from: subDays(base, 7), to: base }),
  last_15d: (base) => ({ from: subDays(base, 15), to: base }),
  last_1m: (base) => ({ from: subMonths(base, 1), to: base }),
  last_3m: (base) => ({ from: subMonths(base, 3), to: base }),
  last_6m: (base) => ({ from: subMonths(base, 6), to: base }),
  last_1y: (base) => ({ from: subYears(base, 1), to: base }),
};

export function roundToMinute(date: Date) {
  const ms = 60_000;
  return new Date(Math.floor(date.getTime() / ms) * ms);
}

export function parsePreset(val: string | null): PresetKey | null {
  if (!val) return null;
  return presetOptions.some((p) => p.key === val) ? (val as PresetKey) : null;
}

export function computePresetRange(key: PresetKey, base: Date = new Date()): DateRange | undefined {
  const fn = presetRanges[key];
  if (!fn) return undefined;
  const rounded = roundToMinute(base);
  const next = fn(rounded);
  return {
    from: next.from ? roundToMinute(next.from) : undefined,
    to: next.to ? roundToMinute(next.to) : undefined,
  };
}
