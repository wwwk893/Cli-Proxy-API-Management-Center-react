"use client";

import { useI18n } from "@/components/i18n-context";
import { cn } from "@/lib/utils";

export type ModelUsageDetailRow = {
  model: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedTokens: number;
  inputCostUsd: number | null;
  outputCostUsd: number | null;
  cachedCostUsd: number | null;
  pricingConfigured: boolean;
};

type Variant = "popover" | "tooltip" | "inline";

export function ModelUsageDetail({ row, variant = "popover" }: { row: ModelUsageDetailRow; variant?: Variant }) {
  const { t, locale } = useI18n();
  const isCompact = variant === "tooltip";

  const renderCost = (value: number | null) => {
    if (!row.pricingConfigured || value == null || !Number.isFinite(value)) {
      return <span className="text-muted-foreground italic">{t("detailNotConfigured")}</span>;
    }
    return <span className="font-mono">{formatCurrency(value, locale)}</span>;
  };

  return (
    <div
      className={cn(
        "grid gap-3",
        isCompact ? "text-[11px] leading-snug" : "text-sm",
      )}
    >
      <div className={cn("grid gap-4", isCompact ? "grid-cols-1" : "grid-cols-2")}>
        <div>
          <p className="text-xs text-muted-foreground">{t("detailTokensTitle")}</p>
          <dl className="mt-2 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <dt>{t("detailInputTokens")}</dt>
              <dd className="font-mono">{formatCompact(row.inputTokens, locale)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>{t("detailOutputTokens")}</dt>
              <dd className="font-mono">{formatCompact(row.outputTokens, locale)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1">
                {t("detailReasoningTokens")}
                {row.reasoningTokens > 0 ? (
                  <span className="text-[10px] text-muted-foreground">{t("detailReasoningHint")}</span>
                ) : null}
              </dt>
              <dd className="font-mono">{formatCompact(row.reasoningTokens, locale)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>{t("detailCachedTokens")}</dt>
              <dd className="font-mono">{formatCompact(row.cachedTokens, locale)}</dd>
            </div>
          </dl>
        </div>

        <div>
          <p className="text-xs text-muted-foreground">{t("detailCostsTitle")}</p>
          <dl className="mt-2 space-y-1">
            <div className="flex items-center justify-between gap-3">
              <dt>{t("detailInputCost")}</dt>
              <dd>{renderCost(row.inputCostUsd)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>{t("detailOutputCost")}</dt>
              <dd>{renderCost(row.outputCostUsd)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>{t("detailCachedCost")}</dt>
              <dd>{renderCost(row.cachedCostUsd)}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

function formatCompact(value: number, locale?: string) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    compactDisplay: "short",
    maximumFractionDigits: 1,
  }).format(value);
}

function formatCurrency(value: number, locale?: string) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
}
