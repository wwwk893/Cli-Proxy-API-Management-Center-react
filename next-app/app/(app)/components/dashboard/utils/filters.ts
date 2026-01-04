import type { DashboardChannel, DashboardTimeWindow } from "@/lib/dashboard/overview/types";

export type DashboardFilters = {
  timeWindow: DashboardTimeWindow;
  channel: DashboardChannel;
};

export const DASHBOARD_TIME_WINDOWS: DashboardTimeWindow[] = ["utc-today", "last-24h", "last-7d", "last-30d"];
export const DASHBOARD_CHANNELS: DashboardChannel[] = ["all", "cliproxy", "codex"];

export function isDashboardTimeWindow(value: string | null): value is DashboardTimeWindow {
  return !!value && (DASHBOARD_TIME_WINDOWS as readonly string[]).includes(value);
}

export function isDashboardChannel(value: string | null): value is DashboardChannel {
  return !!value && (DASHBOARD_CHANNELS as readonly string[]).includes(value);
}

export function buildUsageHref(filters: DashboardFilters): string {
  const params = new URLSearchParams();
  params.set("timeWindow", filters.timeWindow);
  params.set("channel", filters.channel);
  return `/usage?${params.toString()}`;
}
