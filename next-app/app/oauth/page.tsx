"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { OAuthProvider } from "@/components/oauth/types";
import { DEFAULT_POLLING_POLICY } from "@/components/oauth/types";
import { AuthFlowPanel } from "@/components/oauth/auth-flow-panel";
import { IflowCookieLogin } from "@/components/oauth/iflow-cookie-login";
import { ProviderGrid } from "@/components/oauth/provider-grid";
import { useOAuthFlow } from "@/components/oauth/use-oauth-flow";
import { CopyButton } from "@/components/common/copy-button";
import { PageHeader } from "@/components/common/page-header";
import { useI18n } from "@/components/i18n-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PendingConfirm =
  | { type: "switch-provider"; nextProvider: OAuthProvider }
  | { type: "reset-flow" }
  | null;

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

function parseModtime(modtime?: string) {
  if (!modtime) return 0;
  const t = new Date(modtime).getTime();
  return Number.isFinite(t) ? t : 0;
}

function AuthFilesPanel({ anchorId, flowPhase }: { anchorId: string; flowPhase: string }) {
  const { t, locale } = useI18n();
  const localeTag = locale === "zh" ? "zh-CN" : "en-US";

  const pageSize = 20;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rawFiles, setRawFiles] = useState<AuthFileEntry[]>([]);

  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<AuthFileEntry | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const prevPhaseRef = useRef<string | null>(null);

  const loadFiles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth-files", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ApiResult<AuthFilesData> | null;
      if (!res.ok || json?.error) {
        throw new Error(json?.error?.message || res.statusText || t("authFiles.errorTitle"));
      }
      const list = json?.data?.files;
      setRawFiles(Array.isArray(list) ? list.filter(Boolean) : []);
    } catch (e) {
      const message = e instanceof Error ? e.message : t("oauth.errors.unknown");
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = flowPhase;
    if (flowPhase === "success" && prev !== "success") {
      void loadFiles();
    }
  }, [flowPhase, loadFiles]);

  const files = useMemo(() => {
    return rawFiles.filter(isVisibleAuthFile).sort((a, b) => parseModtime(b.modtime) - parseModtime(a.modtime));
  }, [rawFiles]);

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
      const json = (await res.json().catch(() => null)) as ApiResult<{ uploaded: boolean }> | null;
      if (!res.ok || json?.error) {
        throw new Error(json?.error?.message || res.statusText || t("authFiles.errorTitle"));
      }
      await loadFiles();
    } catch (e) {
      const message = e instanceof Error ? e.message : t("oauth.errors.unknown");
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
        const message = json?.error?.message || res.statusText || t("authFiles.errorTitle");
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
      const message = e instanceof Error ? e.message : t("oauth.errors.unknown");
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
      const json = (await res.json().catch(() => null)) as ApiResult<Record<string, unknown>> | null;
      if (!res.ok || json?.error) {
        throw new Error(json?.error?.message || res.statusText || t("authFiles.errorTitle"));
      }
      await loadFiles();
    } catch (e) {
      const message = e instanceof Error ? e.message : t("oauth.errors.unknown");
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
      const json = (await res.json().catch(() => null)) as ApiResult<Record<string, unknown>> | null;
      if (!res.ok || json?.error) {
        throw new Error(json?.error?.message || res.statusText || t("authFiles.errorTitle"));
      }
      await loadFiles();
    } catch (e) {
      const message = e instanceof Error ? e.message : t("oauth.errors.unknown");
      setError(message);
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <div id={anchorId}>
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

      <Card className="border-border/60 bg-card/60 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold">{t("authFiles.title")}</div>
              <Badge variant="secondary">{files.length}</Badge>
            </div>
            <div className="mt-1 text-sm text-muted-foreground">{t("authFiles.subtitle")}</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
        </div>

        {error ? (
          <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <div className="font-medium">{t("authFiles.errorTitle")}</div>
            <div className="mt-1 break-words text-xs">{error}</div>
            <div className="mt-3">
              <Button size="sm" variant="secondary" onClick={loadFiles} disabled={isLoading || isMutating}>
                {t("retry")}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("authFiles.searchPlaceholder")}
            className="sm:max-w-sm"
            disabled={isLoading || isMutating}
          />
          <div className="flex items-center gap-2">
            <div className="text-sm text-muted-foreground">{t("authFiles.filter.type")}</div>
            <Select value={filterType} onValueChange={setFilterType} disabled={isLoading || isMutating}>
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
                      <TableCell className="max-w-[420px] truncate font-medium">{file.name}</TableCell>
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
                        <div className="flex flex-wrap items-center gap-2">
                          <Button size="sm" variant="secondary" onClick={() => openDetails(file)} disabled={isMutating}>
                            {t("authFiles.actions.details")}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => downloadFile(file)} disabled={!canOperate || isMutating}>
                            {t("authFiles.actions.download")}
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteFile(file)} disabled={!canOperate || isMutating}>
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
                <Button variant="secondary" size="sm" disabled={currentPage <= 1 || isMutating} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  {t("authFiles.actions.prev")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={currentPage >= totalPages || isMutating}
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
        <DialogContent className="overflow-hidden sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("authFiles.details.title")}</DialogTitle>
          </DialogHeader>

          {selected ? (
            <div className="flex min-w-0 flex-col gap-3">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="min-w-0 truncate text-sm font-medium">{selected.name}</div>
                <CopyButton text={JSON.stringify(selected, null, 2)} />
              </div>
              <pre className="max-h-[380px] max-w-full min-w-0 overflow-auto rounded-md bg-muted p-3 text-xs">
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

export default function OAuthCenterPage() {
  const { t } = useI18n();
  const authFilesAnchorId = "oauth-auth-files";

  const goAuthFilesInline = useCallback(() => {
    const el = document.getElementById(authFilesAnchorId);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [authFilesAnchorId]);

  const { flow, isBusy, timeLeftSec, setProvider, reset, generateUrl } = useOAuthFlow({
    pollIntervalMs: DEFAULT_POLLING_POLICY.intervalMs,
    timeoutMs: DEFAULT_POLLING_POLICY.timeoutMs,
    errorResetMs: DEFAULT_POLLING_POLICY.errorResetMs,
  });

  const [confirm, setConfirm] = useState<PendingConfirm>(null);

  const needsConfirm = useMemo(() => {
    return flow.phase !== "idle" || Boolean(flow.url) || Boolean(flow.state);
  }, [flow.phase, flow.state, flow.url]);

  const requestSwitchProvider = (nextProvider: OAuthProvider) => {
    if (nextProvider === flow.provider) return;
    if (!needsConfirm) {
      setProvider(nextProvider);
      return;
    }
    setConfirm({ type: "switch-provider", nextProvider });
  };

  const requestResetFlow = () => {
    if (!needsConfirm) {
      reset();
      return;
    }
    setConfirm({ type: "reset-flow" });
  };

  const closeConfirm = () => setConfirm(null);

  const onConfirm = () => {
    const pending = confirm;
    setConfirm(null);

    if (!pending) return;
    reset();
    if (pending.type === "switch-provider") {
      setProvider(pending.nextProvider);
    }
  };

  const confirmTitle =
    confirm?.type === "switch-provider" ? t("oauth.confirm.switchTitle") : t("oauth.confirm.resetTitle");
  const confirmDesc =
    confirm?.type === "switch-provider" ? t("oauth.confirm.switchDesc") : t("oauth.confirm.resetDesc");

  return (
    <div className="flex flex-col gap-3">
      <PageHeader
        title={t("oauth.title")}
        description={t("oauth.subtitle")}
      />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <ProviderGrid value={flow.provider} onChange={requestSwitchProvider} disabled={false} />
          <div className="mt-3 text-xs text-muted-foreground">{t("oauth.providerHint")}</div>
        </div>

        <div className="flex flex-col gap-3 lg:col-span-2">
          <AuthFlowPanel
            provider={flow.provider}
            flow={flow}
            timeLeftSec={timeLeftSec}
            isBusy={isBusy}
            onGenerate={() => generateUrl(flow.provider)}
            onReset={requestResetFlow}
            onGoAuthFiles={goAuthFilesInline}
          />

          {flow.provider === "iflow" ? <IflowCookieLogin onGoAuthFiles={goAuthFilesInline} /> : null}
        </div>
      </div>

      <AuthFilesPanel anchorId={authFilesAnchorId} flowPhase={flow.phase} />

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => {
          if (!open) closeConfirm();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{confirmTitle}</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">{confirmDesc}</div>
          <DialogFooter>
            <Button variant="outline" onClick={closeConfirm}>
              {t("cancel")}
            </Button>
            <Button onClick={onConfirm}>{t("confirm")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
