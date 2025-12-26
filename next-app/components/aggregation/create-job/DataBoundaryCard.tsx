"use client";

import { Info } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";

type DataBoundaryCardProps = {
  metaLoading: boolean;
  metaError: string | null;
  earliestLoading: boolean;
  earliestError: string | null;
  hasAvailableRange: boolean;
  earliestEventTime: string | null;
  formatLocalDateTime: (iso?: string | null) => string;
  t: (key: string) => string;
};

export function DataBoundaryCard({
  metaLoading,
  metaError,
  earliestLoading,
  earliestError,
  hasAvailableRange,
  earliestEventTime,
  formatLocalDateTime,
  t,
}: DataBoundaryCardProps) {
  return (
    <Card className="border-l-4 border-primary/60 bg-muted/40 shadow-sm">
      <CardHeader className="space-y-1">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Info className="h-4 w-4 text-primary" />
          {t("aggregationDataBoundary")}
        </div>
        <CardDescription>{t("aggregationUtcNotice")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {metaLoading ? (
          <div className="h-4 w-56 rounded-md bg-muted animate-pulse" />
        ) : metaError ? (
          <div className="text-sm text-destructive">{metaError}</div>
        ) : (
          <div className="text-sm">
            {earliestLoading ? (
              <span className="text-muted-foreground">{t("loading")}</span>
            ) : (
              <span>
                {t("aggregationEarliestLabel")}：{formatLocalDateTime(earliestEventTime)}
              </span>
            )}
          </div>
        )}
        {earliestError && <div className="text-xs text-destructive">{earliestError}</div>}
        {!hasAvailableRange && !metaLoading && (
          <div className="text-xs text-destructive">{t("aggregationNoAvailableRange")}</div>
        )}
      </CardContent>
    </Card>
  );
}
