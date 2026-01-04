import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { DashboardOverviewResponse } from "@/lib/dashboard/overview/types";

export function PartialErrorsDetailsCard({
  t,
  data,
  refresh,
}: {
  t: (key: string) => string;
  data: DashboardOverviewResponse;
  refresh: () => void;
}) {
  const hasRetryable = data.partialErrors.some((e) => e.retryable);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("dashboard.partialErrors.detailsTitle")}</CardTitle>
        <CardDescription>{t("dashboard.partialErrors.detailsSubtitle")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {data.partialErrors.slice(0, 6).map((e) => {
          const accent = e.retryable ? "var(--chart-1)" : "var(--muted-foreground)";

          return (
            <div
              key={`${e.source}:${e.code}:${e.message}`}
              style={{ borderLeftColor: accent }}
              className="flex items-start justify-between gap-3 rounded-md border border-l-4 px-3 py-2 transition hover:bg-[var(--surface-hover)]"
            >
              <div className="min-w-0">
                <div className="text-sm font-medium">{e.source}</div>
                <div className="text-xs text-muted-foreground">
                  {e.code}: {e.message}
                </div>
              </div>
              {e.retryable ? (
                <Badge
                  variant="outline"
                  className="shrink-0"
                  style={{
                    borderColor: "var(--chart-1)",
                    backgroundColor: "color-mix(in oklab, var(--chart-1) 12%, transparent)",
                    color: "var(--chart-1)",
                  }}
                >
                  {t("dashboard.partialErrors.retryable")}
                </Badge>
              ) : (
                <Badge variant="outline" className="shrink-0" style={{ borderColor: "var(--border)" }}>
                  {t("dashboard.partialErrors.notRetryable")}
                </Badge>
              )}
            </div>
          );
        })}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={refresh} disabled={!hasRetryable} title={!hasRetryable ? t("dashboard.partialErrors.notRetryable") : undefined}>
            {t("dashboard.partialErrors.refresh")}
          </Button>
          <Button asChild variant="outline">
            <Link href="/logs">{t("dashboard.links.logs")}</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
