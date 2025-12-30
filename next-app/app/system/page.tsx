"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/common/page-header";
import { CopyButton } from "@/components/common/copy-button";
import { useI18n } from "@/components/i18n-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type ApiResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: { code: string; message: string; details?: any } };

type HealthData = {
  connected: boolean;
  managementUrl: string;
  managementBase: string;
  serverVersion: string | null;
  serverBuildDate: string | null;
};

export default function SystemPage() {
  const { t, locale } = useI18n();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<ApiResult<HealthData>["error"] | null>(null);
  const [data, setData] = useState<HealthData | null>(null);

  const fetchHealth = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/system/health", { cache: "no-store" });
      const json = (await res.json()) as ApiResult<HealthData>;
      if (!res.ok || json.error) {
        setError(json.error || { code: "UNKNOWN", message: res.statusText });
        setData(null);
        return;
      }
      setError(null);
      setData(json.data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError({ code: "UNKNOWN", message });
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const diagnostics = useMemo(() => {
    const now = new Date().toISOString();
    return JSON.stringify(
      {
        at: now,
        locale,
        health: data,
        error,
        ua: typeof navigator !== "undefined" ? navigator.userAgent : null,
      },
      null,
      2,
    );
  }, [data, error, locale]);

  const statusBadge = useMemo(() => {
    if (isLoading) return <Badge variant="secondary">{t("loading")}</Badge>;
    if (data?.connected) return <Badge variant="default">{t("health.connected")}</Badge>;
    return <Badge variant="destructive">{t("health.disconnected")}</Badge>;
  }, [data?.connected, isLoading, t]);

  const formatBuildDate = (value: string | null) => {
    if (!value) return "-";
    const parsed = Date.parse(value);
    if (Number.isNaN(parsed)) return value;
    return new Date(parsed).toLocaleString(locale === "zh" ? "zh-CN" : "en-US");
  };

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title={t("system.title")}
        description={t("system.subtitle")}
        actions={
          <Button variant="secondary" onClick={fetchHealth} disabled={isLoading}>
            {t("retry")}
          </Button>
        }
      />

      <Card className="border-border/60 bg-card/60 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">{t("health.status")}</div>
            {statusBadge}
          </div>
          <CopyButton text={diagnostics} />
        </div>

        <Separator className="my-4" />

        {error ? (
          <div className="rounded-lg border border-border bg-background/40 p-4">
            <div className="text-sm font-semibold">{t("health.error.title")}</div>
            <div className="mt-1 text-sm text-muted-foreground">{error.message}</div>
            <div className="mt-3 text-xs text-muted-foreground">{t("system.copyHint")}</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-background/40 p-4">
              <div className="text-sm font-medium">{t("health.managementBase")}</div>
              <div className="mt-1 text-sm text-muted-foreground break-all">{data?.managementUrl}</div>
            </div>

            <div className="rounded-lg border border-border bg-background/40 p-4">
              <div className="text-sm font-medium">{t("health.serverInfo")}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {t("health.serverVersion")}: {data?.serverVersion || "-"}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {t("health.serverBuildDate")}: {formatBuildDate(data?.serverBuildDate || null)}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
