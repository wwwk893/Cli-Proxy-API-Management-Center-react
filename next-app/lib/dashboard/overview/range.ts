import type { DashboardTimeWindow } from "./types";

export type DashboardRangeGranularity = "hour" | "day";

export type DashboardResolvedRange = {
  from: Date;
  to: Date;
  granularity: DashboardRangeGranularity;
};

function getUtcStartOfToday(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function resolveDashboardRange(timeWindow: DashboardTimeWindow): DashboardResolvedRange {
  const to = new Date();

  switch (timeWindow) {
    case "utc-today":
      return {
        from: getUtcStartOfToday(to),
        to,
        granularity: "hour",
      };
    case "last-24h":
      return {
        from: new Date(to.getTime() - 24 * 60 * 60 * 1000),
        to,
        granularity: "hour",
      };
    case "last-7d": {
      const utcTodayStart = getUtcStartOfToday(to);
      return {
        from: new Date(utcTodayStart.getTime() - 6 * 24 * 60 * 60 * 1000),
        to,
        granularity: "day",
      };
    }
    case "last-30d": {
      const utcTodayStart = getUtcStartOfToday(to);
      return {
        from: new Date(utcTodayStart.getTime() - 29 * 24 * 60 * 60 * 1000),
        to,
        granularity: "day",
      };
    }
    default: {
      const exhaustiveCheck: never = timeWindow;
      throw new Error(`Unsupported DashboardTimeWindow: ${exhaustiveCheck}`);
    }
  }
}
