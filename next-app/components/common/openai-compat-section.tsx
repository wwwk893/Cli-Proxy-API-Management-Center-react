"use client";

import { useState } from "react";

import type { OpenAIKeyEntry, OpenAIProviderEntry, ProvidersData } from "@/components/common/providers-types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ApiResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: { code: string; message: string } };

export function OpenAICompatSection(props: {
  rows: OpenAIProviderEntry[];
  busy: boolean;
  setBusy: (busy: boolean) => void;
  t: (key: string) => string;
  setError: (message: string | null) => void;
  onUpdated: (data: ProvidersData) => void;
}) {
  const { rows, busy, setBusy, t, setError, onUpdated } = props;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [dialogIndex, setDialogIndex] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [existingKeys, setExistingKeys] = useState<Array<OpenAIKeyEntry & { remove?: boolean }>>([]);
  const [newKeys, setNewKeys] = useState<Array<{ apiKey: string; proxyUrl: string }>>([{ apiKey: "", proxyUrl: "" }]);

  const openAdd = () => {
    setDialogMode("add");
    setDialogIndex(null);
    setName("");
    setBaseUrl("");
    setExistingKeys([]);
    setNewKeys([{ apiKey: "", proxyUrl: "" }]);
    setDialogOpen(true);
  };

  const openEdit = (row: OpenAIProviderEntry) => {
    setDialogMode("edit");
    setDialogIndex(row.index);
    setName(row.name || "");
    setBaseUrl(row.baseUrl || "");
    setExistingKeys(row.keys.map((k) => ({ ...k, remove: false })));
    setNewKeys([{ apiKey: "", proxyUrl: "" }]);
    setDialogOpen(true);
  };

  const submit = async () => {
    const nextName = name.trim();
    const nextBaseUrl = baseUrl.trim();
    if (!nextName) {
      setError(t("providers.openaiCompat.validation.nameRequired"));
      return;
    }
    if (!nextBaseUrl) {
      setError(t("providers.openaiCompat.validation.baseUrlRequired"));
      return;
    }

    const addEntries = newKeys
      .map((k) => ({ apiKey: k.apiKey.trim(), proxyUrl: k.proxyUrl.trim() }))
      .filter((k) => k.apiKey);

    if (dialogMode === "add" && addEntries.length === 0) {
      setError(t("providers.openaiCompat.validation.atLeastOneKey"));
      return;
    }

    const deleteIndices = existingKeys.filter((k) => k.remove).map((k) => k.index);
    const update = existingKeys
      .filter((k) => !k.remove)
      .map((k) => ({ index: k.index, proxyUrl: (k.proxyUrl || "").trim() }));

    if (dialogMode === "edit") {
      const remaining = existingKeys.filter((k) => !k.remove).length + addEntries.length;
      if (remaining <= 0) {
        setError(t("providers.openaiCompat.validation.atLeastOneKey"));
        return;
      }
    }

    setBusy(true);
    setError(null);
    try {
      const payload =
        dialogMode === "add"
          ? {
              provider: "openaiCompat",
              entry: { name: nextName, baseUrl: nextBaseUrl, apiKeyEntries: addEntries },
            }
          : {
              provider: "openaiCompat",
              index: dialogIndex,
              entry: {
                name: nextName,
                baseUrl: nextBaseUrl,
                keys: { update, delete: deleteIndices, add: addEntries },
              },
            };

      const res = await fetch("/api/providers", {
        method: dialogMode === "add" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as ApiResult<ProvidersData>;
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || res.statusText || "Failed to save provider");
      }
      onUpdated(json.data);
      setDialogOpen(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const deleteProvider = async (row: OpenAIProviderEntry) => {
    const confirmed = window.confirm(t("providers.openaiCompat.deleteConfirm"));
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/providers?provider=${encodeURIComponent("openaiCompat")}&index=${encodeURIComponent(String(row.index))}`,
        { method: "DELETE" },
      );
      const json = (await res.json()) as ApiResult<ProvidersData>;
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || res.statusText || "Failed to delete provider");
      }
      onUpdated(json.data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card className="border-border/60 bg-card/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">{t("providers.openaiCompat.title")}</div>
            <div className="text-sm text-muted-foreground">{t("providers.openaiCompat.subtitle")}</div>
          </div>
          <Button onClick={openAdd} disabled={busy}>
            {t("providers.actions.add")}
          </Button>
        </div>

        {rows.length === 0 ? (
          <div className="mt-6 text-sm text-muted-foreground">{t("providers.empty")}</div>
        ) : (
          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("providers.table.index")}</TableHead>
                  <TableHead>{t("providers.table.name")}</TableHead>
                  <TableHead>{t("providers.table.baseUrl")}</TableHead>
                  <TableHead>{t("providers.openaiCompat.table.keysCount")}</TableHead>
                  <TableHead>{t("providers.openaiCompat.table.modelsCount")}</TableHead>
                  <TableHead>{t("providers.table.headers")}</TableHead>
                  <TableHead>{t("providers.table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.index}>
                    <TableCell className="text-muted-foreground">#{row.index + 1}</TableCell>
                    <TableCell className="text-sm">{row.name || "-"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.baseUrl || "-"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.keys.length}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.modelsCount ?? 0}</TableCell>
                    <TableCell>
                      {row.hasHeaders ? <Badge variant="outline">{t("providers.headers.present")}</Badge> : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="secondary" onClick={() => openEdit(row)} disabled={busy}>
                          {t("providers.actions.edit")}
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteProvider(row)} disabled={busy}>
                          {t("delete")}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {dialogMode === "edit"
                ? t("providers.openaiCompat.dialog.editTitle")
                : t("providers.openaiCompat.dialog.addTitle")}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <div className="text-sm font-medium">{t("providers.openaiCompat.dialog.name")}</div>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <div className="text-sm font-medium">{t("providers.openaiCompat.dialog.baseUrl")}</div>
                <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium">{t("providers.openaiCompat.dialog.keys")}</div>

              {dialogMode === "edit" && existingKeys.length ? (
                <div className="rounded-md border border-border/60 p-3">
                  <div className="text-xs text-muted-foreground">{t("providers.openaiCompat.dialog.existingKeysHint")}</div>
                  <div className="mt-2 flex flex-col gap-2">
                    {existingKeys.map((k) => (
                      <div key={k.index} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                        <div className="font-mono text-xs text-muted-foreground sm:w-40">{k.maskedKey}</div>
                        <Input
                          value={k.proxyUrl || ""}
                          onChange={(e) =>
                            setExistingKeys((prev) =>
                              prev.map((x) => (x.index === k.index ? { ...x, proxyUrl: e.target.value } : x)),
                            )
                          }
                          placeholder={t("providers.openaiCompat.dialog.proxyUrlPlaceholder")}
                          disabled={Boolean(k.remove)}
                        />
                        <Button
                          size="sm"
                          variant={k.remove ? "secondary" : "destructive"}
                          onClick={() =>
                            setExistingKeys((prev) =>
                              prev.map((x) => (x.index === k.index ? { ...x, remove: !x.remove } : x)),
                            )
                          }
                        >
                          {k.remove ? t("providers.openaiCompat.dialog.undoRemove") : t("providers.openaiCompat.dialog.remove")}
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="rounded-md border border-border/60 p-3">
                <div className="text-xs text-muted-foreground">{t("providers.openaiCompat.dialog.newKeysHint")}</div>
                <div className="mt-2 flex flex-col gap-2">
                  {newKeys.map((k, idx) => (
                    <div key={idx} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <Input
                        value={k.apiKey}
                        onChange={(e) =>
                          setNewKeys((prev) => prev.map((x, i) => (i === idx ? { ...x, apiKey: e.target.value } : x)))
                        }
                        placeholder={t("providers.openaiCompat.dialog.apiKeyPlaceholder")}
                      />
                      <Input
                        value={k.proxyUrl}
                        onChange={(e) =>
                          setNewKeys((prev) => prev.map((x, i) => (i === idx ? { ...x, proxyUrl: e.target.value } : x)))
                        }
                        placeholder={t("providers.openaiCompat.dialog.proxyUrlPlaceholder")}
                      />
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() =>
                          setNewKeys((prev) => {
                            if (prev.length <= 1) return [{ apiKey: "", proxyUrl: "" }];
                            return prev.filter((_, i) => i !== idx);
                          })
                        }
                      >
                        {t("providers.openaiCompat.dialog.removeRow")}
                      </Button>
                    </div>
                  ))}
                  <Button variant="secondary" onClick={() => setNewKeys((prev) => [...prev, { apiKey: "", proxyUrl: "" }])}>
                    {t("providers.openaiCompat.dialog.addRow")}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setDialogOpen(false)} disabled={busy}>
              {t("cancel")}
            </Button>
            <Button onClick={submit} disabled={busy}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

