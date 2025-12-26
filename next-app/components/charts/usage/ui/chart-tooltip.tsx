import type { TooltipProps } from "recharts";

type Props = TooltipProps<number, string> & {
  labelFormatter?: (value: string) => string;
  onToggleSeries?: (dataKey: string) => void;
  isActiveSeries?: (dataKey: string) => boolean;
};

const compactFormatter = new Intl.NumberFormat(undefined, {
  notation: "compact",
  maximumFractionDigits: 2,
});

const usdFormatter = new Intl.NumberFormat(undefined, {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 4,
});

export function ChartTooltip({ active, payload, label, labelFormatter, onToggleSeries, isActiveSeries }: Props) {
  if (!active || !payload || payload.length === 0) return null;
  const timeLabel = labelFormatter ? labelFormatter(String(label)) : label;

  return (
    <div className="pointer-events-auto max-w-[180px] rounded-sm border border-white/10 bg-zinc-950/90 px-2 py-1.5 text-[10px] text-zinc-100 shadow-2xl">
      <p className="mb-1 font-mono text-[10px] text-zinc-400">{timeLabel}</p>
      <div className="space-y-0.5">
        {payload.map((entry, idx) => {
          const color = entry.color ?? "var(--foreground)";
          const name = entry.name ?? entry.dataKey;
          const dataKey = String(entry.dataKey ?? "");
          const rawValue = extractRawValue(entry.payload, dataKey, Number(entry.value ?? 0));
          const formattedValue = dataKey.toLowerCase().includes("cost") ? usdFormatter.format(rawValue) : compactFormatter.format(rawValue);
          const activeState = isActiveSeries ? isActiveSeries(dataKey) : true;
          const clickable = Boolean(onToggleSeries && dataKey);
          const handleToggle = () => {
            if (!onToggleSeries) return;
            onToggleSeries(dataKey);
          };
          return (
            <button
              key={`${name}-${idx}`}
              type="button"
              onClick={(event) => {
                if (!clickable) return;
                event.preventDefault();
                event.stopPropagation();
                handleToggle();
              }}
              className={`flex w-full items-center justify-between gap-3 rounded-sm px-1 py-0.5 text-left transition ${clickable ? "hover:bg-white/5" : "cursor-default"} ${activeState ? "" : "opacity-60 line-through"}`}
            >
              <div className="flex items-center gap-1.5 text-zinc-300">
                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
                <span>{name}</span>
              </div>
              <span className="font-mono text-white">{formattedValue}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

type TooltipDatum = {
  cachedTokens?: number;
  computedTokens?: number;
  [key: string]: unknown;
};

function extractRawValue(payload: TooltipDatum | null | undefined, key: string, fallback: number) {
  if (!payload) return fallback;
  if (key === "chartCachedTokens" && typeof payload.cachedTokens === "number") {
    return payload.cachedTokens;
  }
  if (key === "chartComputedTokens" && typeof payload.computedTokens === "number") {
    return payload.computedTokens;
  }
  return fallback;
}
