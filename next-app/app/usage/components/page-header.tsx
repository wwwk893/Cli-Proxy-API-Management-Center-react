"use client";

import { useI18n } from "@/components/i18n-context";

export function UsagePageHeader() {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="space-y-1">
        <p className="text-xs uppercase tracking-[0.2em] text-cyan-400" suppressHydrationWarning>
          {t("analytics")}
        </p>
        <h1 className="text-3xl font-bold text-foreground">{t("usageInsights")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
    </div>
  );
}
