import Link from "next/link";
import { ExternalLink } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { EmptyModule } from "./shared";

import type { DashboardActionItem, DashboardOverviewResponse } from "@/lib/dashboard/overview/types";

function getActionBadgeVariant(
  severity: DashboardActionItem["severity"],
): "default" | "secondary" | "destructive" | "outline" {
  switch (severity) {
    case "critical":
      return "destructive";
    case "high":
      return "default";
    case "medium":
      return "secondary";
    case "low":
      return "outline";
    default:
      return "outline";
  }
}

function severityLabel(t: (key: string) => string, severity: DashboardActionItem["severity"]): string {
  switch (severity) {
    case "critical":
      return t("dashboard.actionCenter.severity.critical");
    case "high":
      return t("dashboard.actionCenter.severity.high");
    case "medium":
      return t("dashboard.actionCenter.severity.medium");
    case "low":
      return t("dashboard.actionCenter.severity.low");
    default:
      return severity;
  }
}

function severityAccent(severity: DashboardActionItem["severity"]): string {
  switch (severity) {
    case "critical":
      return "var(--destructive)";
    case "high":
      return "var(--chart-3)";
    case "medium":
      return "var(--chart-1)";
    case "low":
      return "var(--muted-foreground)";
    default:
      return "var(--muted-foreground)";
  }
}

export function ActionCenterCard({
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
        <CardTitle>{t("dashboard.actionCenter.title")}</CardTitle>
        <CardDescription>{t("dashboard.actionCenter.subtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {stateKind === "loading" ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : data ? (
          data.actionCenter.slice(0, 5).map((item) => (
            <Link
              key={`${item.kind}:${item.href}`}
              href={item.href}
              style={{ borderLeftColor: severityAccent(item.severity) }}
              className="flex items-start gap-2 rounded-lg border border-l-4 px-3 py-2 transition hover:bg-[var(--surface-hover)] active:bg-[var(--surface-active)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Badge variant={getActionBadgeVariant(item.severity)} className="mt-0.5 shrink-0">
                {severityLabel(t, item.severity)}
              </Badge>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium">{item.title}</div>
                {item.description ? <div className="text-xs text-muted-foreground">{item.description}</div> : null}
              </div>
              <ExternalLink className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
            </Link>
          ))
        ) : (
          <EmptyModule
            title={t("dashboard.actionCenter.unavailable.title")}
            description={t("dashboard.actionCenter.unavailable.subtitle")}
            href="/system"
          />
        )}
      </CardContent>
    </Card>
  );
}
