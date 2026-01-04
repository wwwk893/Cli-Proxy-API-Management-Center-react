import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { formatCompact } from "../utils/format";

import type { DashboardOverviewResponse } from "@/lib/dashboard/overview/types";

export function ConfigHealthCard({
  t,
  configHealth,
}: {
  t: (key: string) => string;
  configHealth: DashboardOverviewResponse["configHealth"] | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.configHealth.title")}</CardTitle>
        <CardDescription>{t("dashboard.configHealth.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2">
        <Link
          href="/settings/providers"
          className="rounded-lg border p-3 transition hover:bg-[var(--surface-hover)] active:bg-[var(--surface-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <div className="text-sm font-medium">{t("dashboard.configHealth.providers")}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {!configHealth || configHealth.providersSummary.totalUpstreamKeysCount === null
              ? t("dashboard.common.unavailable")
              : `${t("dashboard.configHealth.providers.keys")}: ${formatCompact(configHealth.providersSummary.totalUpstreamKeysCount)}`}
          </div>
        </Link>
        <Link
          href="/settings/api-keys"
          className="rounded-lg border p-3 transition hover:bg-[var(--surface-hover)] active:bg-[var(--surface-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <div className="text-sm font-medium">{t("dashboard.configHealth.apiKeys")}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {!configHealth || configHealth.apiKeysCount === null
              ? t("dashboard.common.unavailable")
              : `${t("dashboard.configHealth.apiKeys.count")}: ${formatCompact(configHealth.apiKeysCount)}`}
          </div>
        </Link>
        <Link
          href="/pricing"
          className="rounded-lg border p-3 transition hover:bg-[var(--surface-hover)] active:bg-[var(--surface-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <div className="text-sm font-medium">{t("dashboard.configHealth.pricing")}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {!configHealth || configHealth.pricingCoverage.missingModelsCount === null
              ? t("dashboard.common.unavailable")
              : `${t("dashboard.configHealth.pricing.missing")}: ${formatCompact(configHealth.pricingCoverage.missingModelsCount)}`}
          </div>
        </Link>
        <Link
          href="/settings"
          className="rounded-lg border p-3 transition hover:bg-[var(--surface-hover)] active:bg-[var(--surface-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <div className="text-sm font-medium">{t("dashboard.configHealth.settings")}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {!configHealth || configHealth.settingsSummary.usageStatisticsEnabled === null
              ? t("dashboard.common.unavailable")
              : configHealth.settingsSummary.usageStatisticsEnabled
                ? t("dashboard.configHealth.settings.usageEnabled")
                : t("dashboard.configHealth.settings.usageDisabled")}
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
