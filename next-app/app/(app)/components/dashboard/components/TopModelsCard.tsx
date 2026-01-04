import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { EmptyModule } from "./shared";
import { formatPercent, formatUsd } from "../utils/format";

import type { DashboardTopModelRow, DashboardOverviewResponse } from "@/lib/dashboard/overview/types";

function rankMarker(idx: number): string {
  return `#${idx + 1}`;
}

function rankAccent(idx: number): string {
  switch (idx) {
    case 0:
      return "var(--chart-3)";
    case 1:
      return "var(--chart-1)";
    case 2:
      return "var(--chart-4)";
    default:
      return "var(--muted-foreground)";
  }
}

function sharePercent(shareCost: DashboardTopModelRow["shareCost"]): number {
  const pct = Math.round((shareCost ?? 0) * 100);
  if (!Number.isFinite(pct)) return 0;
  return Math.min(100, Math.max(0, pct));
}

export function TopModelsCard({
  t,
  stateKind,
  data,
  usageHref,
}: {
  t: (key: string) => string;
  stateKind: "loading" | "ready" | "auth-required" | "error";
  data: DashboardOverviewResponse | null;
  usageHref: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.topModels.title")}</CardTitle>
        <CardDescription>{t("dashboard.topModels.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {stateKind === "loading" ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : data?.topModels ? (
          data.topModels.length > 0 ? (
            <div className="space-y-2">
              {data.topModels.slice(0, 5).map((row, idx) => (
                <div
                  key={row.model}
                  style={{ borderLeftColor: "var(--chart-3)" }}
                  className="rounded-md border border-l-4 px-3 py-2 transition hover:bg-[var(--surface-hover)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-flex h-5 w-8 items-center justify-center rounded border text-xs font-semibold"
                          style={{
                            borderColor: rankAccent(idx),
                            color: rankAccent(idx),
                            backgroundColor: `color-mix(in oklab, ${rankAccent(idx)} 10%, transparent)`,
                          }}
                        >
                          {rankMarker(idx)}
                        </span>
                        <span className="truncate text-sm font-medium">{row.model}</span>
                        {row.pricingConfigured === false ? (
                          <Badge
                            variant="outline"
                            className="shrink-0"
                            style={{
                              borderColor: "var(--chart-3)",
                              backgroundColor: "color-mix(in oklab, var(--chart-3) 12%, transparent)",
                              color: "var(--chart-3)",
                            }}
                          >
                            {t("dashboard.topModels.pricingMissing")}
                          </Badge>
                        ) : null}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {t("dashboard.topModels.share")}: {formatPercent(row.shareCost)}
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-muted">
                        <div
                          className="h-full rounded"
                          style={{ width: `${sharePercent(row.shareCost)}%`, backgroundColor: "var(--chart-3)" }}
                        />
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold">{formatUsd(row.costUsd)}</div>
                  </div>
                </div>
              ))}
              <Button asChild variant="outline" size="sm" className="w-full">
                <Link href={usageHref}>{t("dashboard.topModels.viewUsage")}</Link>
              </Button>
            </div>
          ) : (
            <EmptyModule title={t("dashboard.topModels.empty.title")} description={t("dashboard.topModels.empty.subtitle")} href={usageHref} />
          )
        ) : (
          <EmptyModule
            title={t("dashboard.topModels.unavailable.title")}
            description={t("dashboard.topModels.unavailable.subtitle")}
            href={usageHref}
          />
        )}
      </CardContent>
    </Card>
  );
}
