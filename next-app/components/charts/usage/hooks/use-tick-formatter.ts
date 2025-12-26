import { useCallback } from "react";
import { Granularity } from "../types";

export function useTickFormatter(granularity: Granularity) {
  return useCallback(
    (value: string) => {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      switch (granularity) {
        case "second":
          return date.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          });
        case "minute":
          return date.toLocaleTimeString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
          });
        case "hour":
          return date.toLocaleString(undefined, {
            month: "short",
            day: "2-digit",
            hour: "2-digit",
          });
        case "day":
        default:
          return date.toLocaleDateString(undefined, {
            month: "short",
            day: "2-digit",
          });
      }
    },
    [granularity],
  );
}
