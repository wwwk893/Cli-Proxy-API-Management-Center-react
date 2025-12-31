"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/common/page-header";
import { useI18n } from "@/components/i18n-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

type ApiResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: { code: string; message: string; details?: unknown } };

type SettingsData = {
  debug: boolean;
  proxyUrl: string;
  requestRetry: number;
  usageStatisticsEnabled: boolean;
  requestLog: boolean;
  wsAuth: boolean;
  loggingToFile: boolean;
  quotaSwitchProject: boolean;
  quotaSwitchPreviewModel: boolean;
};

function equals(a: SettingsData, b: SettingsData) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function diffSettings(base: SettingsData, next: SettingsData): Partial<SettingsData> {
  const out: Partial<SettingsData> = {};
  (Object.keys(next) as Array<keyof SettingsData>).forEach((k) => {
    if (next[k] !== base[k]) {
      (out as Partial<Record<keyof SettingsData, SettingsData[keyof SettingsData]>>)[k] = next[k];
    }
  });
  return out;
}

function ToggleRow(props: {
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  const { label, description, checked, disabled, onCheckedChange } = props;
  return (
    <label className="flex items-start justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {description ? (
          <div className="text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
      <input
        type="checkbox"
        className="mt-1 size-4 accent-primary"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onCheckedChange(e.target.checked)}
      />
    </label>
  );
}

export default function SettingsPage() {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [remote, setRemote] = useState<SettingsData | null>(null);
  const [draft, setDraft] = useState<SettingsData | null>(null);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/settings", { cache: "no-store" });
      const json = (await res.json()) as ApiResult<SettingsData>;
      if (!res.ok || json.error) {
        const message = json.error?.message || res.statusText || "Failed to load settings";
        throw new Error(message);
      }
      setRemote(json.data);
      setDraft(json.data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const isDirty = useMemo(() => {
    if (!remote || !draft) return false;
    return !equals(remote, draft);
  }, [draft, remote]);

  const onSave = async () => {
    if (!remote || !draft) return;
    const patch = diffSettings(remote, draft);
    if (Object.keys(patch).length === 0) return;

    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const json = (await res.json()) as ApiResult<SettingsData>;
      if (!res.ok || json.error) {
        const message = json.error?.message || res.statusText || "Failed to save settings";
        throw new Error(message);
      }
      setRemote(json.data);
      setDraft(json.data);
      setSuccess(t("settings.saveSuccess"));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    } finally {
      setIsSaving(false);
    }
  };

  const onReset = () => {
    if (!remote) return;
    setDraft(remote);
    setError(null);
    setSuccess(null);
  };

  const updateDraft = (updater: (prev: SettingsData) => SettingsData) => {
    setDraft((prev) => (prev ? updater(prev) : prev));
    setSuccess(null);
  };

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title={t("settings.title")}
        description={t("settings.subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={fetchSettings} disabled={isLoading || isSaving}>
              {t("refresh")}
            </Button>
            <Button variant="secondary" onClick={onReset} disabled={!isDirty || isSaving}>
              {t("reset")}
            </Button>
            <Button onClick={onSave} disabled={!isDirty || isSaving}>
              {isSaving ? t("settings.saving") : t("common.save")}
            </Button>
          </div>
        }
      />

      <Card className="border-border/60 bg-card/60 p-4">
        {error ? (
          <div className="rounded-lg border border-border bg-background/40 p-4">
            <div className="text-sm font-semibold">{t("settings.errorTitle")}</div>
            <div className="mt-1 text-sm text-muted-foreground">{error}</div>
            <div className="mt-3">
              <Button variant="secondary" onClick={fetchSettings}>
                {t("retry")}
              </Button>
            </div>
          </div>
        ) : null}

        {success ? (
          <div className="mb-4 rounded-lg border border-border bg-background/40 p-3 text-sm text-muted-foreground">
            {success}
          </div>
        ) : null}

        {isLoading || !draft ? (
          <div className="text-sm text-muted-foreground">{t("loading")}</div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-sm font-semibold">{t("settings.section.general")}</div>
              <div className="mt-2">
                <ToggleRow
                  label={t("settings.debug.label")}
                  description={t("settings.debug.desc")}
                  checked={draft.debug}
                  disabled={isSaving}
                  onCheckedChange={(v) => updateDraft((p) => ({ ...p, debug: v }))}
                />
              </div>
            </div>

            <Separator />

            <div>
              <div className="text-sm font-semibold">{t("settings.section.network")}</div>
              <div className="mt-2 flex flex-col gap-2">
                <div className="text-sm font-medium">{t("settings.proxyUrl.label")}</div>
                <div className="flex items-center gap-2">
                  <Input
                    value={draft.proxyUrl}
                    placeholder={t("settings.proxyUrl.placeholder")}
                    onChange={(e) => updateDraft((p) => ({ ...p, proxyUrl: e.target.value }))}
                    disabled={isSaving}
                  />
                  <Button
                    variant="secondary"
                    onClick={() => updateDraft((p) => ({ ...p, proxyUrl: "" }))}
                    disabled={isSaving || !draft.proxyUrl}
                  >
                    {t("settings.proxyUrl.clear")}
                  </Button>
                </div>
                <div className="text-sm text-muted-foreground">{t("settings.proxyUrl.desc")}</div>
              </div>

              <div className="mt-4 flex flex-col gap-2">
                <div className="text-sm font-medium">{t("settings.requestRetry.label")}</div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    value={String(draft.requestRetry)}
                    onChange={(e) => {
                      const num = Number(e.target.value);
                      updateDraft((p) => ({ ...p, requestRetry: Number.isFinite(num) ? num : 0 }));
                    }}
                    disabled={isSaving}
                  />
                </div>
                <div className="text-sm text-muted-foreground">{t("settings.requestRetry.desc")}</div>
              </div>
            </div>

            <Separator />

            <div>
              <div className="text-sm font-semibold">{t("settings.section.logging")}</div>
              <div className="mt-2">
                <ToggleRow
                  label={t("settings.loggingToFile.label")}
                  description={t("settings.loggingToFile.desc")}
                  checked={draft.loggingToFile}
                  disabled={isSaving}
                  onCheckedChange={(v) => updateDraft((p) => ({ ...p, loggingToFile: v }))}
                />
                <ToggleRow
                  label={t("settings.requestLog.label")}
                  description={t("settings.requestLog.desc")}
                  checked={draft.requestLog}
                  disabled={isSaving}
                  onCheckedChange={(v) => updateDraft((p) => ({ ...p, requestLog: v }))}
                />
              </div>
            </div>

            <Separator />

            <div>
              <div className="text-sm font-semibold">{t("settings.section.security")}</div>
              <div className="mt-2">
                <ToggleRow
                  label={t("settings.wsAuth.label")}
                  description={t("settings.wsAuth.desc")}
                  checked={draft.wsAuth}
                  disabled={isSaving}
                  onCheckedChange={(v) => updateDraft((p) => ({ ...p, wsAuth: v }))}
                />
              </div>
            </div>

            <Separator />

            <div>
              <div className="text-sm font-semibold">{t("settings.section.quota")}</div>
              <div className="mt-2">
                <ToggleRow
                  label={t("settings.quotaSwitchProject.label")}
                  description={t("settings.quotaSwitchProject.desc")}
                  checked={draft.quotaSwitchProject}
                  disabled={isSaving}
                  onCheckedChange={(v) => updateDraft((p) => ({ ...p, quotaSwitchProject: v }))}
                />
                <ToggleRow
                  label={t("settings.quotaSwitchPreviewModel.label")}
                  description={t("settings.quotaSwitchPreviewModel.desc")}
                  checked={draft.quotaSwitchPreviewModel}
                  disabled={isSaving}
                  onCheckedChange={(v) => updateDraft((p) => ({ ...p, quotaSwitchPreviewModel: v }))}
                />
              </div>
            </div>

            <Separator />

            <div>
              <div className="text-sm font-semibold">{t("settings.section.usage")}</div>
              <div className="mt-2">
                <ToggleRow
                  label={t("settings.usageStatisticsEnabled.label")}
                  description={t("settings.usageStatisticsEnabled.desc")}
                  checked={draft.usageStatisticsEnabled}
                  disabled={isSaving}
                  onCheckedChange={(v) => updateDraft((p) => ({ ...p, usageStatisticsEnabled: v }))}
                />
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
