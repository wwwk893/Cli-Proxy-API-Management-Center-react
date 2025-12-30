"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/common/page-header";
import { CopyButton } from "@/components/common/copy-button";
import { useI18n } from "@/components/i18n-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

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

function formatBuildDate(value: string | null, locale: "en" | "zh") {
  if (!value) return "-";
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return value;
  return new Date(parsed).toLocaleString(locale === "zh" ? "zh-CN" : "en-US");
}

export default function LoginPage() {
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

  const envHint = useMemo(() => {
    const managementUrl = data?.managementUrl || error?.details?.managementUrl || "";
    const base = data?.managementBase || error?.details?.managementBase || "";
    return [
      "CLIPROXY_MANAGEMENT_BASE=" + (managementUrl || base || "http://localhost:3818/v0/management"),
      "CLIPROXY_MANAGEMENT_KEY=***",
    ].join("\n");
  }, [data, error]);

  const statusBadge = useMemo(() => {
    if (isLoading) return <Badge variant="secondary">{t("loading")}</Badge>;
    if (data?.connected) return <Badge variant="default">{t("health.connected")}</Badge>;
    return <Badge variant="destructive">{t("health.disconnected")}</Badge>;
  }, [data?.connected, isLoading, t]);

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title={t("login.title")}
        description={t("login.subtitle")}
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
          <div className="text-xs text-muted-foreground">
            {t("health.source")}: /api/system/health
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-border bg-background/40 p-4">
            <div className="text-sm font-semibold">{t("health.error.title")}</div>
            <div className="mt-1 text-sm text-muted-foreground">{error.message}</div>

            {error.code === "ENV_MISSING" ? (
              <div className="mt-4">
                <div className="text-sm font-medium">{t("health.envMissing.title")}</div>
                <p className="mt-1 text-sm text-muted-foreground">{t("health.envMissing.desc")}</p>
                <div className="mt-2 rounded-md bg-muted/50 p-3">
                  <pre className="text-xs whitespace-pre-wrap break-all">{envHint}</pre>
                </div>
                <div className="mt-2">
                  <CopyButton text={envHint} />
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-border bg-background/40 p-4">
              <div className="text-sm font-medium">{t("health.managementBase")}</div>
              <div className="mt-1 text-sm text-muted-foreground break-all">{data?.managementUrl}</div>
              <div className="mt-2">
                <CopyButton text={data?.managementUrl || ""} />
              </div>
            </div>

            <div className="rounded-lg border border-border bg-background/40 p-4">
              <div className="text-sm font-medium">{t("health.serverInfo")}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {t("health.serverVersion")}: {data?.serverVersion || "-"}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {t("health.serverBuildDate")}: {formatBuildDate(data?.serverBuildDate || null, locale)}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
