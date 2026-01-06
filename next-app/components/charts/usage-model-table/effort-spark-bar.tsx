"use client";

import type { EffortDistribution } from "./types";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const COLORS: Record<keyof EffortDistribution, string> = {
  low: "var(--chart-1)",
  medium: "var(--chart-2)",
  high: "var(--chart-3)",
  xhigh: "var(--chart-4)",
  unspecified: "var(--muted-foreground)",
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function formatPercent(value: number, locale?: string) {
  if (!Number.isFinite(value)) return "—";
  const clamped = clamp(value, 0, 1);
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 }).format(clamped);
}

export function EffortSparkBar({
  distribution,
  locale,
  className,
}: {
  distribution: EffortDistribution;
  locale?: string;
  className?: string;
}) {
  const items: Array<{ key: keyof EffortDistribution; label: string; share: number }> = [
    { key: "low", label: "low", share: distribution.low },
    { key: "medium", label: "medium", share: distribution.medium },
    { key: "high", label: "high", share: distribution.high },
    { key: "xhigh", label: "xhigh", share: distribution.xhigh },
    { key: "unspecified", label: "unspecified", share: distribution.unspecified },
  ];

  return (
    <div className={cn("flex items-end gap-0.5", className)} aria-label="effort distribution">
      {items.map((item) => {
        const share = Number.isFinite(item.share) ? item.share : 0;
        const height = 2 + Math.round(clamp(share, 0, 1) * 12); // 2..14px
        return (
          <Tooltip key={item.key}>
            <TooltipTrigger asChild>
              <div
                className="w-1.5 rounded-sm"
                style={{
                  height,
                  backgroundColor: COLORS[item.key],
                  opacity: share > 0 ? 1 : 0.25,
                }}
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs font-mono">
              {item.label}: {formatPercent(share, locale)}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

