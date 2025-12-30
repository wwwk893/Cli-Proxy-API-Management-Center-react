"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PageHeader } from "@/components/common/page-header";
import { CopyButton } from "@/components/common/copy-button";
import { useI18n } from "@/components/i18n-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type ApiResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: { code: string; message: string } };

type AuthFileEntry = {
  name: string;
  type?: string;
  provider?: string;
  size?: number;
  modtime?: string;
  disabled?: boolean;
  runtime_only?: boolean;
  auth_index?: string | number;
  [key: string]: unknown;
};

type AuthFilesData = { files: AuthFileEntry[] };

function formatFileSize(bytes?: number) {
  if (bytes === undefined || bytes === null || !Number.isFinite(bytes)) return "-";
  const value = Math.max(0, bytes);
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / 1024 / 1024).toFixed(1)} MB`;
  return `${(value / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function isRuntimeOnly(file: AuthFileEntry) {
  return file.runtime_only === true || file.runtime_only === "true";
}

function shouldDisplayDisabledGeminiCli(file: AuthFileEntry) {
  const provider = typeof file.provider === "string" ? file.provider.toLowerCase() : "";
  const type = typeof file.type === "string" ? file.type.toLowerCase() : "";
  const isGeminiCli = provider === "gemini-cli" || type === "gemini-cli";
  return isGeminiCli && !isRuntimeOnly(file);
}

function isVisibleAuthFile(file: AuthFileEntry) {
  if (!file) return false;
  if (file.disabled === true && !shouldDisplayDisabledGeminiCli(file)) return false;
  return true;
}

export default function AuthFilesPage() {
  const { t, locale } = useI18n();
  const localeTag = locale === "zh" ? "zh-CN" : "en-US";

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [data, setData] = useState<AuthFilesData | null>(null);
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selected, setSelected] = useState<AuthFileEntry | null>(null);

  const loadFiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth-files", { cache: "no-store" });
      const json = (await res.json()) as ApiResult<AuthFilesData>;
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || res.statusText || "Failed to load auth files");
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
    loadFiles();
  }, [loadFiles]);

  const files = useMemo(() => {
    const raw = data?.files || [];
    return raw.filter(isVisibleAuthFile);
  }, [data?.files]);

  const typeOptions = useMemo(() => {
    const types = new Set<string>();
    files.forEach((f) => {
      const type = (f.type || f.provider || "").trim();
      if (type) types.add(type);
    });
    return ["all", ...Array.from(types).sort((a, b) => a.localeCompare(b))];
  }, [files]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const type = (filterType || "all").toLowerCase();
    return files.filter((f) => {
      const name = String(f.name || "").toLowerCase();
      const tpe = String(f.type || "").toLowerCase();
      const provider = String(f.provider || "").toLowerCase();

      if (type !== "all") {
        if (tpe !== type && provider !== type) return false;
      }
      if (keyword && !name.includes(keyword)) return false;
      return true;
    });
  }, [files, filterType, query]);

  useEffect(() => {
    setPage(1);
  }, [query, filterType]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const openDetails = (file: AuthFileEntry) => {
    setSelected(file);
    setDetailsOpen(true);
  };

  const triggerUpload = () => {
    fileInputRef.current?.click();
  };

  const onUpload = async (file: File) => {
    if (!file.name.endsWith(".json")) {
      setError(t("authFiles.upload.invalidJson"));
      return;
    }

    setIsMutating(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file, file.name);

      const res = await fetch("/api/auth-files", { method: "POST", body: form });
      const json = (await res.json()) as ApiResult<{ uploaded: boolean }>;
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || res.statusText || "Failed to upload auth file");
      }
      await loadFiles();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    } finally {
      setIsMutating(false);
    }
  };

  const downloadFile = async (file: AuthFileEntry) => {
    if (!file?.name) return;
    try {
      const res = await fetch(`/api/auth-files/download?name=${encodeURIComponent(file.name)}`);
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as ApiResult<unknown> | null;
        const message = json?.error?.message || res.statusText || "Failed to download auth file";
        throw new Error(message);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    }
  };

  const deleteFile = async (file: AuthFileEntry) => {
    if (!file?.name) return;
    const confirmed = window.confirm(`${t("authFiles.confirm.deleteOne")} "${file.name}"`);
    if (!confirmed) return;

    setIsMutating(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth-files?name=${encodeURIComponent(file.name)}`, { method: "DELETE" });
      const json = (await res.json()) as ApiResult<Record<string, unknown>>;
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || res.statusText || "Failed to delete auth file");
      }
      await loadFiles();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    } finally {
      setIsMutating(false);
    }
  };

  const deleteAll = async () => {
    const confirmed = window.confirm(t("authFiles.confirm.deleteAll"));
    if (!confirmed) return;

    setIsMutating(true);
    setError(null);
    try {
      const res = await fetch("/api/auth-files?all=true", { method: "DELETE" });
      const json = (await res.json()) as ApiResult<Record<string, unknown>>;
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || res.statusText || "Failed to delete auth files");
      }
      await loadFiles();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      setError(message);
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept=".json"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void onUpload(file);
        }}
      />

      <PageHeader
        title={t("authFiles.title")}
        description={t("authFiles.subtitle")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={loadFiles} disabled={isLoading || isMutating}>
              {t("refresh")}
            </Button>
            <Button variant="secondary" onClick={triggerUpload} disabled={isMutating}>
              {t("authFiles.actions.upload")}
            </Button>
            <Button variant="destructive" onClick={deleteAll} disabled={isMutating}>
              {t("authFiles.actions.deleteAll")}
            </Button>
          </div>
        }
      />

      {error ? (
        <Card className="border-border/60 bg-card/60 p-4">
          <div className="text-sm font-semibold">{t("authFiles.errorTitle")}</div>
          <div className="mt-1 text-sm text-muted-foreground">{error}</div>
        </Card>
      ) : null}

      <Card className="border-border/60 bg-card/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("authFiles.searchPlaceholder")}
            className="sm:max-w-sm"
          />
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">{t("authFiles.filter.type")}</div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder={t("authFiles.filter.all")} />
              </SelectTrigger>
              <SelectContent>
                {typeOptions.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type === "all" ? t("authFiles.filter.all") : type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator className="my-4" />

        {isLoading ? (
          <div className="text-sm text-muted-foreground">{t("loading")}</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground">{t("authFiles.empty")}</div>
        ) : (
          <div className="flex flex-col gap-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("authFiles.table.name")}</TableHead>
                  <TableHead>{t("authFiles.table.type")}</TableHead>
                  <TableHead>{t("authFiles.table.modified")}</TableHead>
                  <TableHead>{t("authFiles.table.size")}</TableHead>
                  <TableHead>{t("authFiles.table.flags")}</TableHead>
                  <TableHead>{t("authFiles.table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pageItems.map((file) => {
                  const runtimeOnly = isRuntimeOnly(file);
                  const disabled = file.disabled === true;
                  const canOperate = !runtimeOnly;
                  const mod = file.modtime ? new Date(file.modtime).toLocaleString(localeTag) : "-";
                  const type = file.type || file.provider || "-";
                  return (
                    <TableRow key={file.name}>
                      <TableCell className="font-medium">{file.name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{type}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{mod}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatFileSize(file.size)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1">
                          {runtimeOnly ? <Badge variant="secondary">{t("authFiles.flag.runtimeOnly")}</Badge> : null}
                          {disabled ? <Badge variant="outline">{t("authFiles.flag.disabled")}</Badge> : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="secondary" onClick={() => openDetails(file)}>
                            {t("authFiles.actions.details")}
                          </Button>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => downloadFile(file)}
                            disabled={!canOperate}
                          >
                            {t("authFiles.actions.download")}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteFile(file)} disabled={!canOperate}>
                            {t("delete")}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                {t("authFiles.pagination")} {currentPage}/{totalPages} · {filtered.length}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  {t("authFiles.actions.prev")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  {t("authFiles.actions.next")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("authFiles.details.title")}</DialogTitle>
          </DialogHeader>

          {selected ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-medium">{selected.name}</div>
                <CopyButton text={JSON.stringify(selected, null, 2)} />
              </div>
              <pre className="max-h-[380px] overflow-auto rounded-md bg-muted p-3 text-xs">
                {JSON.stringify(selected, null, 2)}
              </pre>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="secondary" onClick={() => setDetailsOpen(false)}>
              {t("cancel")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

