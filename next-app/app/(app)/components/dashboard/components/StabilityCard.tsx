import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { formatRelativeTime } from "../utils/format";

import type { DashboardOverviewResponse } from "@/lib/dashboard/overview/types";

export function StabilityCard({
  t,
  stateKind,
  data,
}: {
  t: (key: string) => string;
  stateKind: "loading" | "ready" | "auth-required" | "error";
  data: DashboardOverviewResponse | null;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.stability.title")}</CardTitle>
        <CardDescription>{t("dashboard.stability.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        <Link
          href="/pipeline"
          className="rounded-lg border p-3 transition hover:bg-[var(--surface-hover)] active:bg-[var(--surface-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <div className="text-sm font-medium">{t("dashboard.stability.pipeline")}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {data?.pipeline
              ? `${t("dashboard.stability.pipeline.pending")} ${data.pipeline.pending} · ${t("dashboard.stability.pipeline.failed")} ${
                  data.pipeline.failed
                }`
              : t("dashboard.common.unavailable")}
          </div>
        </Link>
        <Link
          href="/logs"
          className="rounded-lg border p-3 transition hover:bg-[var(--surface-hover)] active:bg-[var(--surface-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <div className="text-sm font-medium">{t("dashboard.stability.logs")}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {data?.logs ? `${t("dashboard.stability.logs.latest")} ${formatRelativeTime(data.logs.latestTimestamp)}` : t("dashboard.common.unavailable")}
          </div>
        </Link>
        <Link
          href="/system"
          className="rounded-lg border p-3 transition hover:bg-[var(--surface-hover)] active:bg-[var(--surface-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <div className="text-sm font-medium">{t("dashboard.stability.system")}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {stateKind === "ready"
              ? data?.system.connected
                ? t("dashboard.kpi.health.connected")
                : t("dashboard.kpi.health.disconnected")
              : "—"}
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
