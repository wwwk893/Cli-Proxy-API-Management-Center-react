"use client";

import { cn } from "@/lib/utils";

export function MetricCell({
  primary,
  secondary,
  percent,
  barColor,
  trackColor = "var(--muted)",
  className,
}: {
  primary: React.ReactNode;
  secondary?: React.ReactNode;
  percent: number;
  barColor?: string;
  trackColor?: string;
  className?: string;
}) {
  const widthPct = Number.isFinite(percent) ? Math.min(Math.max(percent, 0), 100) : 0;
  return (
    <div className={cn("flex w-full min-w-[140px] flex-col justify-center", className)}>
      <div className="mb-1.5 flex h-5 items-baseline justify-between">
        <span className="text-sm font-medium tabular-nums leading-none text-card-foreground">{primary}</span>
        {secondary ? (
          <span className="text-xs text-muted-foreground tabular-nums leading-none ml-2">{secondary}</span>
        ) : null}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: trackColor }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${widthPct}%`, backgroundColor: barColor ?? "var(--chart-1)" }}
        />
      </div>
    </div>
  );
}

function formatPercent(rate?: number, locale?: string) {
  if (!Number.isFinite(rate)) return "—";
  const clamped = Math.max(0, Math.min(1, rate as number));
  return new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(clamped);
}

export function formatCompact(value: number, locale?: string) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatCurrency(value: number, locale?: string) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
}

export function CacheRateCell({
  rate,
  cachedTokens,
  locale,
}: {
  rate?: number;
  cachedTokens: number;
  locale?: string;
}) {
  if (!Number.isFinite(rate)) {
    return <span className="text-muted-foreground">—</span>;
  }

  const clamped = Math.max(0, Math.min(1, rate as number));

  return (
    <MetricCell
      primary={formatPercent(clamped, locale)}
      secondary={cachedTokens > 0 ? formatCompact(cachedTokens, locale) : undefined}
      percent={clamped * 100}
      barColor="var(--chart-2)"
      trackColor="var(--muted)"
    />
  );
}

