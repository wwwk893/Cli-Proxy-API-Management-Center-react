import Link from "next/link";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { formatCompact, formatPercent, formatUsd } from "../utils/format";

import type { DashboardOverviewResponse } from "@/lib/dashboard/overview/types";

function KpiCard({
  title,
  value,
  subtitle,
  href,
  loading,
  accent,
  right,
}: {
  title: string;
  value: string;
  subtitle?: string;
  href: string;
  loading: boolean;
  accent: string;
  right?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card
        style={{ borderLeftColor: accent }}
        className="border-l-4 transition hover:bg-[var(--surface-hover)] hover:shadow-sm active:bg-[var(--surface-active)]"
      >
        <CardContent className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: accent }} />
              <span className="truncate">{title}</span>
            </div>
            {right ? <div className="shrink-0 text-xs text-muted-foreground">{right}</div> : null}
          </div>
          <div className="text-2xl font-semibold tracking-tight">{loading ? <Skeleton className="h-7 w-24" /> : value}</div>
          {subtitle ? <div className="text-xs text-muted-foreground">{subtitle}</div> : <div className="h-4" />}
        </CardContent>
      </Card>
    </Link>
  );
}

export function KpiGrid({
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
  const loading = stateKind === "loading";

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <KpiCard
        title={t("dashboard.kpi.cost")}
        value={formatUsd(data?.kpis?.costUsd)}
        subtitle={t("dashboard.kpi.cost.subtitle")}
        href={usageHref}
        loading={loading}
        accent="var(--chart-3)"
      />
      <KpiCard
        title={t("dashboard.kpi.tokens")}
        value={formatCompact(data?.kpis?.totalTokens)}
        subtitle={t("dashboard.kpi.tokens.subtitle")}
        href={usageHref}
        loading={loading}
        accent="var(--chart-1)"
      />
      <KpiCard
        title={t("dashboard.kpi.requests")}
        value={formatCompact(data?.kpis?.requestCount)}
        subtitle={t("dashboard.kpi.requests.subtitle")}
        href={usageHref}
        loading={loading}
        accent="var(--chart-4)"
      />
      <KpiCard
        title={t("dashboard.kpi.cached")}
        value={data?.kpis && data.kpis.totalTokens > 0 ? formatPercent(data.kpis.cachedTokens / data.kpis.totalTokens) : "—"}
        subtitle={t("dashboard.kpi.cached.subtitle")}
        href={usageHref}
        loading={loading}
        accent="var(--chart-2)"
      />
      <KpiCard
        title={t("dashboard.kpi.pipeline")}
        value={
          data?.pipeline
            ? `${data.pipeline.pending}${t("dashboard.kpi.pipeline.pendingSuffix")} / ${data.pipeline.failed}${t(
                "dashboard.kpi.pipeline.failedSuffix",
              )}`
            : "—"
        }
        subtitle={t("dashboard.kpi.pipeline.subtitle")}
        href="/pipeline"
        loading={loading}
        accent="var(--chart-5)"
      />
      <KpiCard
        title={t("dashboard.kpi.health")}
        value={
          stateKind === "ready"
            ? data?.system.connected
              ? `${t("dashboard.kpi.health.connected")} ${data.system.serverVersion ? `(${data.system.serverVersion})` : ""}`
              : t("dashboard.kpi.health.disconnected")
            : "—"
        }
        subtitle={t("dashboard.kpi.health.subtitle")}
        href="/system"
        loading={loading}
        accent={
          stateKind === "ready"
            ? data?.system.connected
              ? "var(--chart-2)"
              : "var(--destructive)"
            : "var(--muted-foreground)"
        }
      />
    </div>
  );
}
