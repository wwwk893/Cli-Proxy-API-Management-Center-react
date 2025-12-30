"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PageHeader } from "@/components/common/page-header";
import { useI18n } from "@/components/i18n-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ApiResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: { code: string; message: string } };

type ApiKeyRow = {
  index: number;
  maskedKey: string;
};

type ApiKeysData = {
  keys: ApiKeyRow[];
};

export default function ApiKeysPage() {
  const { t } = useI18n();
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiKeysData | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createValue, setCreateValue] = useState("");

  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editValue, setEditValue] = useState("");

  const loadKeys = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/api-keys", { cache: "no-store" });
      const json = (await res.json()) as ApiResult<ApiKeysData>;
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || res.statusText || "Failed to load api keys");
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
    loadKeys();
  }, [loadKeys]);

  const hasKeys = (data?.keys?.length || 0) > 0;

  const onCreate = async () => {
    const value = createValue.trim();
    if (!value) {
      setError(t("apiKeys.validation.required"));
      return;
    }

    setIsMutating(true);
    setError(null);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      const json = (await res.json()) as ApiResult<ApiKeysData>;
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || res.statusText || "Failed to create api key");
      }
      setData(json.data);
      setCreateValue("");
      setCreateOpen(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    } finally {
      setIsMutating(false);
    }
  };

  const onEdit = async () => {
    if (editIndex === null) return;
    const value = editValue.trim();
    if (!value) {
      setError(t("apiKeys.validation.required"));
      return;
    }

    setIsMutating(true);
    setError(null);
    try {
      const res = await fetch("/api/api-keys", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index: editIndex, value }),
      });
      const json = (await res.json()) as ApiResult<ApiKeysData>;
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || res.statusText || "Failed to update api key");
      }
      setData(json.data);
      setEditValue("");
      setEditOpen(false);
      setEditIndex(null);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    } finally {
      setIsMutating(false);
    }
  };

  const onDelete = async (index: number) => {
    const confirmed = window.confirm(t("apiKeys.deleteConfirm"));
    if (!confirmed) return;

    setIsMutating(true);
    setError(null);
    try {
      const res = await fetch(`/api/api-keys?index=${encodeURIComponent(String(index))}`, { method: "DELETE" });
      const json = (await res.json()) as ApiResult<ApiKeysData>;
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || res.statusText || "Failed to delete api key");
      }
      setData(json.data);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    } finally {
      setIsMutating(false);
    }
  };

  const actions = useMemo(
    () => (
      <div className="flex items-center gap-2">
        <Button variant="secondary" onClick={loadKeys} disabled={isLoading || isMutating}>
          {t("refresh")}
        </Button>
        <Button onClick={() => setCreateOpen(true)} disabled={isMutating}>
          {t("apiKeys.actions.add")}
        </Button>
      </div>
    ),
    [isLoading, isMutating, loadKeys, t],
  );

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title={t("apiKeys.title")} description={t("apiKeys.subtitle")} actions={actions} />

      <Card className="border-border/60 bg-card/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="text-sm font-semibold">{t("apiKeys.callout.title")}</div>
            <div className="mt-1 text-sm text-muted-foreground">{t("apiKeys.callout.desc")}</div>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild size="sm">
              <Link href="/settings/providers">{t("apiKeys.callout.actions.providers")}</Link>
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/oauth">{t("apiKeys.callout.actions.oauth")}</Link>
            </Button>
          </div>
        </div>
      </Card>

      <Card className="border-border/60 bg-card/60 p-4">
        {error ? (
          <div className="mb-4 rounded-lg border border-border bg-background/40 p-3 text-sm text-muted-foreground">
            <span className="font-medium">{t("apiKeys.errorTitle")}: </span>
            <span>{error}</span>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <div className="text-sm text-muted-foreground">{t("apiKeys.maskHint")}</div>
          <Badge variant="secondary">
            {t("apiKeys.count")}: {data?.keys?.length || 0}
          </Badge>
        </div>

        {isLoading ? (
          <div className="mt-4 text-sm text-muted-foreground">{t("loading")}</div>
        ) : !hasKeys ? (
          <div className="mt-6 text-sm text-muted-foreground">{t("apiKeys.empty")}</div>
        ) : (
          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("apiKeys.table.index")}</TableHead>
                  <TableHead>{t("apiKeys.table.key")}</TableHead>
                  <TableHead>{t("apiKeys.table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.keys?.map((row) => (
                  <TableRow key={row.index}>
                    <TableCell className="text-muted-foreground">#{row.index + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{row.maskedKey}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setEditIndex(row.index);
                            setEditValue("");
                            setEditOpen(true);
                          }}
                          disabled={isMutating}
                        >
                          {t("apiKeys.actions.replace")}
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onDelete(row.index)}
                          disabled={isMutating}
                        >
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("apiKeys.dialog.addTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <div className="text-sm text-muted-foreground">{t("apiKeys.dialog.addDesc")}</div>
            <Input
              value={createValue}
              onChange={(e) => setCreateValue(e.target.value)}
              placeholder={t("apiKeys.dialog.placeholder")}
            />
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setCreateOpen(false)} disabled={isMutating}>
              {t("cancel")}
            </Button>
            <Button onClick={onCreate} disabled={isMutating}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("apiKeys.dialog.replaceTitle")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <div className="text-sm text-muted-foreground">{t("apiKeys.dialog.replaceDesc")}</div>
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              placeholder={t("apiKeys.dialog.placeholder")}
            />
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setEditOpen(false);
                setEditIndex(null);
              }}
              disabled={isMutating}
            >
              {t("cancel")}
            </Button>
            <Button onClick={onEdit} disabled={isMutating}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
