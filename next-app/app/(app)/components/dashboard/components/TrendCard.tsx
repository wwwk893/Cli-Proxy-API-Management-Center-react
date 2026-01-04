import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { EmptyModule } from "./shared";
import { formatCompactNumber, formatUsdNumber } from "../utils/format";

import type { DashboardTrendMetric } from "@/lib/dashboard/overview/types";
import type { DashboardFilters } from "../utils/filters";
import type { DashboardOverviewResponse } from "@/lib/dashboard/overview/types";

function shouldUseHourlyXAxis(timeWindow: DashboardFilters["timeWindow"]): boolean {
  return timeWindow === "last-24h" || timeWindow === "utc-today";
}

function metricLabel(t: (key: string) => string, value: DashboardTrendMetric): string {
  switch (value) {
    case "costUsd":
      return t("dashboard.trend.metric.cost");
    case "totalTokens":
      return t("dashboard.trend.metric.tokens");
    case "requestCount":
      return t("dashboard.trend.metric.requests");
  }
}

function metricStroke(metric: DashboardTrendMetric): string {
  switch (metric) {
    case "costUsd":
      return "var(--chart-3)";
    case "totalTokens":
      return "var(--chart-1)";
    case "requestCount":
      return "var(--chart-4)";
  }
}

export function TrendCard({
  t,
  stateKind,
  data,
  filters,
  usageHref,
}: {
  t: (key: string) => string;
  stateKind: "loading" | "ready" | "auth-required" | "error";
  data: DashboardOverviewResponse | null;
  filters: DashboardFilters;
  usageHref: string;
}) {
  const [metric, setMetric] = useState<DashboardTrendMetric>("costUsd");

  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>{t("dashboard.trend.title")}</CardTitle>
            <CardDescription>{t("dashboard.trend.subtitle")}</CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href={usageHref} className="gap-2">
              {t("dashboard.trend.viewUsage")}
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </div>

        <Tabs value={metric} onValueChange={(val) => setMetric(val as DashboardTrendMetric)}>
          <TabsList className="w-fit">
            <TabsTrigger value="costUsd">
              <span className="inline-flex items-center gap-2">
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: metricStroke("costUsd") }} />
                {metricLabel(t, "costUsd")}
              </span>
            </TabsTrigger>
            <TabsTrigger value="totalTokens">
              <span className="inline-flex items-center gap-2">
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: metricStroke("totalTokens") }} />
                {metricLabel(t, "totalTokens")}
              </span>
            </TabsTrigger>
            <TabsTrigger value="requestCount">
              <span className="inline-flex items-center gap-2">
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: metricStroke("requestCount") }} />
                {metricLabel(t, "requestCount")}
              </span>
            </TabsTrigger>
          </TabsList>
          <TabsContent value={metric}>
            <div className="h-[240px]">
              {stateKind === "loading" ? (
                <Skeleton className="h-full w-full" />
              ) : data?.trend.buckets ? (
                data.trend.buckets.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                       data={
                         data.trend.buckets.map((b) => {
                           const raw = b[metric];
                           const n = raw === null || raw === undefined ? null : Number(raw);
                           return {
                             ts: b.ts,
                             value: Number.isFinite(n as number) ? (n as number) : null,
                           };
                         })
                       }
                       margin={{ left: 8, right: 8, top: 8, bottom: 8 }}
                     >
                       <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} />
                       <XAxis
                         dataKey="ts"
                         tickMargin={8}
                         axisLine={false}
                         tickLine={false}
                         tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                         tickFormatter={(v) => {
                           const d = new Date(v);
                           if (Number.isNaN(d.getTime())) return "";
                           return shouldUseHourlyXAxis(filters.timeWindow)
                             ? d.toLocaleTimeString(undefined, { hour: "2-digit" })
                             : d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
                         }}
                       />
                       <YAxis
                         tickMargin={8}
                         width={64}
                         axisLine={false}
                         tickLine={false}
                         tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                         tickFormatter={(v) => {
                           if (metric === "costUsd") return formatUsdNumber(Number(v));
                           return formatCompactNumber(Number(v));
                         }}
                       />
                       <RechartsTooltip
                         contentStyle={{
                           background: "var(--popover)",
                           border: "1px solid var(--border)",
                           borderRadius: 10,
                           boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
                         }}
                         labelStyle={{ color: "var(--popover-foreground)", fontSize: 12 }}
                         itemStyle={{ color: "var(--popover-foreground)", fontSize: 12 }}
                         cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                         formatter={(v) => {
                           const n = typeof v === "number" ? v : Number(v);
                           if (!Number.isFinite(n)) return "—";
                           if (metric === "costUsd") return formatUsdNumber(n);
                           return formatCompactNumber(n);
                         }}
                         labelFormatter={(label) => {
                           const d = new Date(label);
                           if (Number.isNaN(d.getTime())) return "";
                           return d.toLocaleString();
                         }}
                       />
                       <Line
                         type="monotone"
                         dataKey="value"
                         stroke={metricStroke(metric)}
                         strokeWidth={2.5}
                         dot={false}
                         activeDot={{ r: 5, stroke: "var(--background)", strokeWidth: 2 }}
                         connectNulls={false}
                         isAnimationActive={false}
                       />
                     </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <EmptyModule
                    title={t("dashboard.trend.empty.title")}
                    description={t("dashboard.trend.empty.subtitle")}
                    href={usageHref}
                  />
                )
              ) : (
                <EmptyModule
                  title={t("dashboard.trend.unavailable.title")}
                  description={t("dashboard.trend.unavailable.subtitle")}
                  href={usageHref}
                />
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardHeader>
    </Card>
  );
}
