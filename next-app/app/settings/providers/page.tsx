"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/common/page-header";
import { OpenAICompatSection } from "@/components/common/openai-compat-section";
import { ProviderKeyTable } from "@/components/common/provider-key-table";
import type { KeyProviderKind, ProviderKeyEntry, ProvidersData } from "@/components/common/providers-types";
import { useI18n } from "@/components/i18n-context";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ApiResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: { code: string; message: string } };

type UpsertKeyEntry = {
  apiKey: string;
  baseUrl?: string;
  proxyUrl?: string;
};

const PROVIDER_TABS: Array<{ value: string; labelKey: string }> = [
  { value: "gemini", labelKey: "providers.tabs.gemini" },
  { value: "codex", labelKey: "providers.tabs.codex" },
  { value: "claude", labelKey: "providers.tabs.claude" },
  { value: "openaiCompat", labelKey: "providers.tabs.openaiCompat" },
];

export default function ProvidersPage() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<string>("gemini");

  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProvidersData | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [dialogProvider, setDialogProvider] = useState<KeyProviderKind>("gemini");
  const [dialogIndex, setDialogIndex] = useState<number | null>(null);
  const [form, setForm] = useState<UpsertKeyEntry>({ apiKey: "", baseUrl: "", proxyUrl: "" });

  const loadProviders = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/providers", { cache: "no-store" });
      const json = (await res.json()) as ApiResult<ProvidersData>;
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || res.statusText || "Failed to load providers");
      }
      setData(json.data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProviders();
  }, [loadProviders]);

  const openAddDialog = (provider: KeyProviderKind) => {
    setDialogMode("add");
    setDialogProvider(provider);
    setDialogIndex(null);
    setForm({ apiKey: "", baseUrl: "", proxyUrl: "" });
    setDialogOpen(true);
  };

  const openEditDialog = (provider: KeyProviderKind, row: ProviderKeyEntry) => {
    setDialogMode("edit");
    setDialogProvider(provider);
    setDialogIndex(row.index);
    setForm({
      apiKey: "",
      baseUrl: row.baseUrl || "",
      proxyUrl: row.proxyUrl || "",
    });
    setDialogOpen(true);
  };

  const submitDialog = async () => {
    const apiKey = form.apiKey.trim();
    const baseUrl = (form.baseUrl || "").trim();
    const proxyUrl = (form.proxyUrl || "").trim();

    const isAdd = dialogMode === "add";
    const isCodex = dialogProvider === "codex";

    if (isAdd && !apiKey) {
      setError(t("providers.validation.apiKeyRequired"));
      return;
    }
    if (isCodex && !baseUrl) {
      setError(t("providers.validation.baseUrlRequired"));
      return;
    }

    setIsMutating(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        provider: dialogProvider,
        index: dialogMode === "edit" ? dialogIndex : undefined,
        entry: {
          apiKey: apiKey || undefined,
          baseUrl,
          proxyUrl,
        },
      };

      const res = await fetch("/api/providers", {
        method: dialogMode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ApiResult<ProvidersData>;
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || res.statusText || "Failed to save provider");
      }
      setData(json.data);
      setDialogOpen(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    } finally {
      setIsMutating(false);
    }
  };

  const deleteRow = async (provider: KeyProviderKind, row: ProviderKeyEntry) => {
    const confirmed = window.confirm(t("providers.deleteConfirm"));
    if (!confirmed) return;

    setIsMutating(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/providers?provider=${encodeURIComponent(provider)}&index=${encodeURIComponent(String(row.index))}`,
        { method: "DELETE" },
      );
      const json = (await res.json()) as ApiResult<ProvidersData>;
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || res.statusText || "Failed to delete provider");
      }
      setData(json.data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    } finally {
      setIsMutating(false);
    }
  };

  const rowsFor = (provider: KeyProviderKind) => (data ? data[provider] : []);

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title={t("providers.title")}
        description={t("providers.subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={loadProviders} disabled={isLoading || isMutating}>
              {t("refresh")}
            </Button>
          </div>
        }
      />

      <Card className="border-border/60 bg-card/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold">{t("providers.callout.title")}</div>
            <div className="mt-1 text-sm text-muted-foreground">{t("providers.callout.desc")}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm">
              <Link href="/oauth">{t("providers.callout.actions.oauth")}</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/settings/api-keys">{t("providers.callout.actions.apiKeys")}</Link>
            </Button>
          </div>
        </div>
      </Card>

      {error ? (
        <Card className="border-border/60 bg-card/60 p-4">
          <div className="text-sm font-semibold">{t("providers.errorTitle")}</div>
          <div className="mt-1 text-sm text-muted-foreground">{error}</div>
        </Card>
      ) : null}

      {isLoading || !data ? (
        <Card className="border-border/60 bg-card/60 p-4">
          <div className="text-sm text-muted-foreground">{t("loading")}</div>
        </Card>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {PROVIDER_TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {t(tab.labelKey)}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="gemini">
            <ProviderKeyTable
              title={t("providers.gemini.title")}
              subtitle={t("providers.gemini.subtitle")}
              rows={rowsFor("gemini")}
              onAdd={() => openAddDialog("gemini")}
              onEdit={(row) => openEditDialog("gemini", row)}
              onDelete={(row) => deleteRow("gemini", row)}
              busy={isMutating}
              t={t}
            />
          </TabsContent>

          <TabsContent value="codex">
            <ProviderKeyTable
              title={t("providers.codex.title")}
              subtitle={t("providers.codex.subtitle")}
              rows={rowsFor("codex")}
              onAdd={() => openAddDialog("codex")}
              onEdit={(row) => openEditDialog("codex", row)}
              onDelete={(row) => deleteRow("codex", row)}
              busy={isMutating}
              t={t}
            />
          </TabsContent>

          <TabsContent value="claude">
            <ProviderKeyTable
              title={t("providers.claude.title")}
              subtitle={t("providers.claude.subtitle")}
              rows={rowsFor("claude")}
              onAdd={() => openAddDialog("claude")}
              onEdit={(row) => openEditDialog("claude", row)}
              onDelete={(row) => deleteRow("claude", row)}
              busy={isMutating}
              t={t}
            />
          </TabsContent>

          <TabsContent value="openaiCompat">
            <OpenAICompatSection
              rows={data.openaiCompat}
              busy={isMutating}
              setBusy={setIsMutating}
              t={t}
              setError={setError}
              onUpdated={(next) => setData(next)}
            />
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "edit" ? t("providers.dialog.editTitle") : t("providers.dialog.addTitle")}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium">{t("providers.dialog.apiKey")}</div>
              <Input
                value={form.apiKey}
                onChange={(e) => setForm((p) => ({ ...p, apiKey: e.target.value }))}
                placeholder={t("providers.dialog.apiKeyPlaceholder")}
              />
              <div className="text-xs text-muted-foreground">
                {dialogMode === "edit" ? t("providers.dialog.apiKeyHintOptional") : t("providers.dialog.apiKeyHint")}
              </div>
            </div>

            <Separator />

            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium">{t("providers.dialog.baseUrl")}</div>
              <Input value={form.baseUrl || ""} onChange={(e) => setForm((p) => ({ ...p, baseUrl: e.target.value }))} />
            </div>

            <div className="flex flex-col gap-1">
              <div className="text-sm font-medium">{t("providers.dialog.proxyUrl")}</div>
              <Input value={form.proxyUrl || ""} onChange={(e) => setForm((p) => ({ ...p, proxyUrl: e.target.value }))} />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => setDialogOpen(false)}
              disabled={isMutating}
            >
              {t("cancel")}
            </Button>
            <Button onClick={submitDialog} disabled={isMutating}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
