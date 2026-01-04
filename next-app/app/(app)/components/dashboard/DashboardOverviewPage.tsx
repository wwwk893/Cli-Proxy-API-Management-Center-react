"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { useI18n } from "@/components/i18n-context";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { ActionCenterCard } from "./components/ActionCenterCard";
import { ConfigHealthCard } from "./components/ConfigHealthCard";
import { FiltersBar } from "./components/FiltersBar";
import { KpiGrid } from "./components/KpiGrid";
import { PartialErrorsDetailsCard } from "./components/PartialErrorsDetailsCard";
import { QuickLinksCard } from "./components/QuickLinksCard";
import { StabilityCard } from "./components/StabilityCard";
import { StatusBanner } from "./components/shared";
import { TopModelsCard } from "./components/TopModelsCard";
import { TrendCard } from "./components/TrendCard";

import { useDashboardOverview } from "./hooks/use-dashboard-overview";
import { buildUsageHref, isDashboardChannel, isDashboardTimeWindow } from "./utils/filters";
import { formatRelativeTime } from "./utils/format";

import type { DashboardOverviewResponse, DashboardTimeWindow, DashboardChannel } from "@/lib/dashboard/overview/types";
import type { DashboardFilters } from "./utils/filters";

export function DashboardOverviewPage() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const filters: DashboardFilters = useMemo(() => {
    const rawTimeWindow = searchParams.get("timeWindow");
    const rawChannel = searchParams.get("channel");

    const timeWindow: DashboardTimeWindow = isDashboardTimeWindow(rawTimeWindow) ? rawTimeWindow : "last-24h";
    const channel: DashboardChannel = isDashboardChannel(rawChannel) ? rawChannel : "all";

    return { timeWindow, channel };
  }, [searchParams]);

  const { state, refreshing, refresh } = useDashboardOverview(filters);

  const setFilters = useCallback(
    (next: Partial<DashboardFilters>) => {
      const nextTimeWindow = next.timeWindow ?? filters.timeWindow;
      const nextChannel = next.channel ?? filters.channel;

      const params = new URLSearchParams(searchParams.toString());

      if (nextTimeWindow === "last-24h") params.delete("timeWindow");
      else params.set("timeWindow", nextTimeWindow);

      if (nextChannel === "all") params.delete("channel");
      else params.set("channel", nextChannel);

      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [filters.channel, filters.timeWindow, pathname, router, searchParams],
  );

  const data: DashboardOverviewResponse | null = state.kind === "ready" ? state.data : null;
  const configHealth = data?.configHealth ?? null;

  const latestEventAge = data?.kpis?.latestEventTime ? formatRelativeTime(data.kpis.latestEventTime) : "—";
  const updatedAge = data?.generatedAt ? formatRelativeTime(data.generatedAt) : "—";

  const isEmpty = !!data?.kpis && data.kpis.totalTokens === 0 && data.kpis.requestCount === 0 && data.kpis.costUsd === 0;
  const isDisconnected = state.kind === "ready" && !state.data.system.connected;
  const hasPartialErrors = state.kind === "ready" && state.data.partialErrors.length > 0;

  const usageHref = buildUsageHref(filters);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <PageHeader title={t("dashboard.title")} description={t("dashboard.subtitle")} />
        </div>

        <FiltersBar
          t={t}
          filters={filters}
          setFilters={setFilters}
          stateKind={state.kind}
          refreshing={refreshing}
          refresh={refresh}
          updatedAge={updatedAge}
          latestEventAge={latestEventAge}
          hasPartialErrors={hasPartialErrors}
          partialErrorsCount={data?.partialErrors.length ?? 0}
        />
      </div>

      {state.kind === "auth-required" ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.authRequired.title")}</CardTitle>
            <CardDescription>{t("dashboard.authRequired.subtitle")}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button asChild>
              <Link
                href={`/login?next=${encodeURIComponent(
                  typeof window !== "undefined" ? window.location.pathname + window.location.search : "/",
                )}`}
              >
                {t("dashboard.authRequired.signIn")}
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/system">{t("dashboard.links.system")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {state.kind === "error" ? (
        <Card>
          <CardHeader>
            <CardTitle>{t("dashboard.error.title")}</CardTitle>
            <CardDescription>{state.message}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Button onClick={refresh}>{t("dashboard.error.retry")}</Button>
            <Button asChild variant="outline">
              <Link href={usageHref}>{t("dashboard.links.usage")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/system">{t("dashboard.links.system")}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/logs">{t("dashboard.links.logs")}</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {state.kind !== "auth-required" && state.kind !== "error" ? (
        <>
            {isDisconnected ? (
              <StatusBanner
                title={t("dashboard.disconnected.title")}
                description={t("dashboard.disconnected.subtitle")}
                actionHref="/system"
                actionLabel={t("dashboard.links.system")}
                variant="error"
              />
            ) : null}

            {hasPartialErrors ? (
              <StatusBanner
                title={t("dashboard.partialErrors.title")}
                description={t("dashboard.partialErrors.subtitle")}
                actionHref="/logs"
                actionLabel={t("dashboard.links.logs")}
                variant="warning"
              />
            ) : null}

            {isEmpty ? (
              <StatusBanner
                title={t("dashboard.empty.title")}
                description={t("dashboard.empty.subtitle")}
                actionHref={usageHref}
                actionLabel={t("dashboard.links.usage")}
                variant="info"
              />
            ) : null}

          <KpiGrid t={t} stateKind={state.kind} data={data} usageHref={usageHref} />

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <TrendCard t={t} stateKind={state.kind} data={data} filters={filters} usageHref={usageHref} />
              <StabilityCard t={t} stateKind={state.kind} data={data} />
              <ConfigHealthCard t={t} configHealth={configHealth} />
            </div>

            <div className="space-y-4">
              <ActionCenterCard t={t} stateKind={state.kind} data={data} />
              <TopModelsCard t={t} stateKind={state.kind} data={data} usageHref={usageHref} />
              <QuickLinksCard t={t} usageHref={usageHref} />
            </div>
          </div>

          {state.kind === "ready" && state.data.partialErrors.length > 0 ? (
            <PartialErrorsDetailsCard t={t} data={state.data} refresh={refresh} />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
