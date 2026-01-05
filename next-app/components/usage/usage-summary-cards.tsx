'use client';

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Coins, Zap, DollarSign, Activity, OctagonAlert } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { useI18n } from "@/components/i18n-context";
import { useUsageFilters } from "@/lib/usage/usage-filters-context";

type UsagePoint = {
  date: string;
  totalTokens: number;
  cachedTokens: number;
  costUsd: number;
  requestCount: number;
  successCount?: number;
  failureCount?: number;
};

type ChannelPoint = UsagePoint & { channel: string };

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);
}

function formatCurrency(value: number) {
  return `$${value.toFixed(3)}`;
}

export function UsageSummaryCards() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<UsagePoint[] | null>(null);
  const [channelData, setChannelData] = useState<ChannelPoint[] | null>(null);
  const { t } = useI18n();
  const {
    state: { selectedChannels },
    actions: { beginRefresh, endRefresh },
  } = useUsageFilters();

  useEffect(() => {
    const controller = new AbortController();
    let completed = false;
    const load = async () => {
      beginRefresh();
      const query = searchParams.toString();
      try {
        const res = await fetch(`/api/usage${query ? `?${query}` : ""}`, { signal: controller.signal });
        const json = await res.json();
        setData(json.data ?? []);
      } catch (err) {
        const isAbort = err instanceof DOMException && err.name === "AbortError";
        if (!isAbort) {
          console.error("usage:summary fetch error", err);
        }
      } finally {
        if (!controller.signal.aborted) {
          endRefresh();
          completed = true;
        }
      }
    };
    load();
    return () => {
      controller.abort();
      if (!completed) endRefresh();
    };
  }, [beginRefresh, endRefresh, searchParams]);

  const includeChannelBreakdown = selectedChannels.length >= 2;

  useEffect(() => {
    if (!includeChannelBreakdown) {
      setChannelData(null);
      return;
    }
    const controller = new AbortController();
    let completed = false;
    const load = async () => {
      beginRefresh();
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", "channel");
      params.set("dimension", "channel");
      const query = params.toString();
      try {
        const res = await fetch(`/api/usage${query ? `?${query}` : ""}`, { signal: controller.signal });
        const json = await res.json();
        setChannelData(json.data ?? []);
      } catch (err) {
        const isAbort = err instanceof DOMException && err.name === "AbortError";
        if (!isAbort) {
          console.error("usage:summary channel fetch error", err);
        }
        setChannelData([]);
      } finally {
        if (!controller.signal.aborted) {
          endRefresh();
          completed = true;
        }
      }
    };
    load();
    return () => {
      controller.abort();
      if (!completed) endRefresh();
    };
  }, [beginRefresh, endRefresh, includeChannelBreakdown, searchParams]);

  const { totalTokens, cachedTokens, costUsd, cacheRatio, failureCount, successCount } = useMemo(() => {
    if (!data) return { totalTokens: 0, cachedTokens: 0, costUsd: 0, cacheRatio: 0, failureCount: 0, successCount: 0 };
    const totals = data.reduce(
      (acc, row) => {
        acc.totalTokens += Number(row.totalTokens ?? 0);
        acc.cachedTokens += Number(row.cachedTokens ?? 0);
        acc.costUsd += Number(row.costUsd ?? 0);
        acc.failureCount += Number(row.failureCount ?? 0);
        acc.successCount += Number(row.successCount ?? 0);
        return acc;
      },
      { totalTokens: 0, cachedTokens: 0, costUsd: 0, failureCount: 0, successCount: 0 },
    );
    const cacheRatio = totals.totalTokens > 0
      ? Math.min(1, totals.cachedTokens / totals.totalTokens)
      : 0;
    return { ...totals, cacheRatio };
  }, [data]);

  const channelTotals = useMemo(() => {
    if (!channelData || !channelData.length) return null;
    const totals: Record<
      "codex" | "opencode" | "cliproxy",
      { totalTokens: number; cachedTokens: number; costUsd: number; requestCount: number }
    > = {
      codex: { totalTokens: 0, cachedTokens: 0, costUsd: 0, requestCount: 0 },
      opencode: { totalTokens: 0, cachedTokens: 0, costUsd: 0, requestCount: 0 },
      cliproxy: { totalTokens: 0, cachedTokens: 0, costUsd: 0, requestCount: 0 },
    };
    channelData.forEach((row) => {
      const key = (row.channel ?? "cliproxy") as keyof typeof totals;
      if (!totals[key]) return;
      totals[key].totalTokens += Number(row.totalTokens ?? 0);
      totals[key].cachedTokens += Number(row.cachedTokens ?? 0);
      totals[key].costUsd += Number(row.costUsd ?? 0);
      totals[key].requestCount += Number(row.requestCount ?? 0);
    });
    return totals;
  }, [channelData]);

  const formatPct = (numerator: number, denominator: number) => {
    if (denominator <= 0) return 0;
    return Math.round((numerator / denominator) * 100);
  };

  const breakdownLine = useMemo(() => {
    if (!channelTotals) return null;
    const channelOrder: Array<keyof typeof channelTotals> = ["codex", "opencode", "cliproxy"];
    const includedChannels = channelOrder.filter((k) => selectedChannels.includes(k));
    if (includedChannels.length < 2) return null;
    const getLabel = (key: keyof typeof channelTotals) => {
      switch (key) {
        case "codex":
          return t("codexCli");
        case "opencode":
          return t("opencodeCli");
        case "cliproxy":
          return t("cliproxyGateway");
      }
    };

    const totalTok = includedChannels.reduce((acc, k) => acc + channelTotals[k].totalTokens, 0);
    const totalCached = includedChannels.reduce((acc, k) => acc + channelTotals[k].cachedTokens, 0);
    const totalCost = includedChannels.reduce((acc, k) => acc + channelTotals[k].costUsd, 0);
    const totalReq = includedChannels.reduce((acc, k) => acc + channelTotals[k].requestCount, 0);

    const joinPct = (value: keyof (typeof channelTotals)["codex"]) =>
      includedChannels
        .map((k) => `${getLabel(k)} ${formatPct(channelTotals[k][value], value === "costUsd" ? totalCost : value === "requestCount" ? totalReq : value === "cachedTokens" ? totalCached : totalTok)}%`)
        .join(" · ");
    return {
      totalTokens: joinPct("totalTokens"),
      cachedTokens: joinPct("cachedTokens"),
      costUsd: joinPct("costUsd"),
      requests: joinPct("requestCount"),
    };
  }, [channelTotals, selectedChannels, t]);

  if (!data) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Skeleton key={idx} className="h-28" />
        ))}
        <Skeleton className="h-28" />
      </div>
    );
  }

  const totalRequests = data.reduce(
    (acc, row) => acc + Number(row.requestCount ?? 0),
    0,
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <KpiCard
        label={t("totalTokens")}
        value={formatNumber(totalTokens)}
        icon={<Zap className="h-5 w-5 text-blue-400" />}
        helper={breakdownLine?.totalTokens ? `${t("tokensProcessed")}\n${breakdownLine.totalTokens}` : t("tokensProcessed")}
        miniData={data.map((d) => ({ value: d.totalTokens }))}
        color="var(--chart-1)"
      />
      <KpiCard
        label={t("cachedTokens")}
        value={formatNumber(cachedTokens)}
        icon={<Coins className="h-5 w-5 text-emerald-400" />}
        helper={
          breakdownLine?.cachedTokens
            ? `${t("cacheHit")} ${Math.round(cacheRatio * 100)}%\n${breakdownLine.cachedTokens}`
            : `${t("cacheHit")} ${Math.round(cacheRatio * 100)}%`
        }
        miniData={data.map((d) => ({ value: d.cachedTokens }))}
        color="var(--chart-2)"
      />
      <KpiCard
        label={t("costUsd")}
        value={formatCurrency(costUsd)}
        icon={<DollarSign className="h-5 w-5 text-rose-400" />}
        helper={breakdownLine?.costUsd ? `${t("estimatedSpend")}\n${breakdownLine.costUsd}` : t("estimatedSpend")}
        miniData={data.map((d) => ({ value: d.costUsd }))}
        color="var(--chart-3)"
      />
      <KpiCard
        label={t("requests")}
        value={formatNumber(totalRequests)}
        icon={<Activity className="h-5 w-5 text-violet-400" />}
        helper={breakdownLine?.requests ? `${t("totalCalls")}\n${breakdownLine.requests}` : t("totalCalls")}
        miniData={data.map((d) => ({ value: d.requestCount }))}
        color="var(--chart-4)"
      />
      <KpiCard
        label={t("failedRequests")}
        value={formatNumber(failureCount)}
        icon={<OctagonAlert className="h-5 w-5 text-rose-500" />}
        helper={successCount ? `${t("successRequests")}: ${formatNumber(successCount)}` : undefined}
        miniData={data.map((d) => ({ value: d.failureCount ?? 0 }))}
        color="hsl(var(--destructive))"
      />
    </div>
  );
}

function KpiCard({
  label,
  value,
  helper,
  icon,
  miniData,
  color,
}: {
  label: string;
  value: string;
  helper?: string;
  icon?: React.ReactNode;
  miniData?: { value: number }[];
  color: string;
}) {
  return (
    <Card className="relative overflow-hidden border border-border bg-card text-card-foreground shadow-lg transition-transform duration-150 ease-out hover:-translate-y-1 hover:shadow-xl">
      <div className="pointer-events-none absolute -top-16 -right-10 h-32 w-32 rounded-full bg-foreground/5 blur-3xl" />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm text-muted-foreground">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="text-2xl font-bold text-foreground font-mono">{value}</div>
        <p className="text-xs text-muted-foreground min-h-[18px] whitespace-pre-line">{helper ?? " "}</p>
        {miniData && miniData.length > 1 && (
          <div className="h-12">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={miniData}>
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={color}
                  fill={color}
                  fillOpacity={0.18}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
