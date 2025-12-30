"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/common/page-header";
import { useI18n } from "@/components/i18n-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type ApiResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: { code: string; message: string; details?: unknown } };

type ConfigData = { content: string };

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "application/yaml;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
}

export default function ConfigPage() {
  const { t } = useI18n();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [remote, setRemote] = useState<string>("");
  const [draft, setDraft] = useState<string>("");

  const isDirty = useMemo(() => draft !== remote, [draft, remote]);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/config", { cache: "no-store" });
      const json = (await res.json()) as ApiResult<ConfigData>;
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || res.statusText || "Failed to load config");
      }
      setRemote(json.data.content || "");
      setDraft(json.data.content || "");
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [isDirty]);

  useEffect(() => {
    const onClickCapture = (e: MouseEvent) => {
      if (!isDirty) return;
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href") || "";
      if (!href.startsWith("/")) return;
      if (href === window.location.pathname) return;
      if (anchor.getAttribute("target") === "_blank") return;
      if (anchor.hasAttribute("download")) return;

      const confirmed = window.confirm(t("config.confirm.leave"));
      if (!confirmed) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [isDirty, t]);

  const onSave = async () => {
    if (!isDirty) return;
    const confirmed = window.confirm(t("config.confirm.save"));
    if (!confirmed) return;

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft }),
      });
      const json = (await res.json()) as ApiResult<{ saved: boolean }>;
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || res.statusText || "Failed to save config");
      }
      setRemote(draft);
      setSuccess(t("config.saveSuccess"));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const onReload = async () => {
    if (isDirty) {
      const confirmed = window.confirm(t("config.confirm.discard"));
      if (!confirmed) return;
    }
    await loadConfig();
  };

  const onDownload = () => {
    const filename = "config.yaml";
    downloadText(filename, draft);
  };

  const onDownloadServer = async () => {
    try {
      const res = await fetch("/api/config/download");
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as ApiResult<unknown> | null;
        const message = json?.error?.message || res.statusText || "Failed to download config";
        throw new Error(message);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "config.yaml";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title={t("config.title")}
        description={t("config.subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={onReload} disabled={isLoading || isSaving}>
              {t("config.actions.reload")}
            </Button>
            <Button variant="secondary" onClick={onDownload} disabled={isLoading}>
              {t("config.actions.downloadDraft")}
            </Button>
            <Button variant="secondary" onClick={onDownloadServer} disabled={isLoading}>
              {t("config.actions.downloadServer")}
            </Button>
            <Button onClick={onSave} disabled={!isDirty || isSaving || isLoading}>
              {isSaving ? t("config.actions.saving") : t("config.actions.save")}
            </Button>
          </div>
        }
      />

      {error ? (
        <Card className="border-border/60 bg-card/60 p-4">
          <div className="text-sm font-semibold">{t("config.errorTitle")}</div>
          <div className="mt-1 text-sm text-muted-foreground">{error}</div>
        </Card>
      ) : null}

      {success ? (
        <Card className="border-border/60 bg-card/60 p-4">
          <div className="text-sm font-semibold">{t("config.successTitle")}</div>
          <div className="mt-1 text-sm text-muted-foreground">{success}</div>
        </Card>
      ) : null}

      <Card className="border-border/60 bg-card/60 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium">{t("config.editorTitle")}</div>
          {isDirty ? (
            <div className="text-xs text-muted-foreground">{t("config.status.dirty")}</div>
          ) : (
            <div className="text-xs text-muted-foreground">{t("config.status.clean")}</div>
          )}
        </div>

        <Separator className="my-3" />

        {isLoading ? (
          <div className="text-sm text-muted-foreground">{t("loading")}</div>
        ) : (
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[520px] w-full resize-y rounded-md border border-border bg-background px-3 py-2 font-mono text-xs leading-5 outline-none focus:ring-2 focus:ring-ring"
            placeholder={t("config.editorPlaceholder")}
          />
        )}
      </Card>
    </div>
  );
}

