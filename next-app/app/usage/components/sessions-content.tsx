"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Filter, Search, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-context";
import { useUsageFilters } from "@/lib/usage/usage-filters-context";

type SessionRow = {
  sessionId: string;
  firstActivity: string;
  lastActivity: string;
  durationMs: number;
  cwd: string | null;
  originator: string | null;
  cliVersion: string | null;
  effort: string | null;
  deviceId: string | null;
  models: string[];
  turns: number;
  inputTokens: number;
  cachedTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  costUsd: number;
};

type Facets = {
  models: { value: string; count: number }[];
  originators: { value: string; count: number }[];
  devices: { value: string; count: number }[];
  cwds: { value: string; count: number }[];
  efforts: { value: string; count: number }[];
};

type SessionDetail = {
  sessionId: string;
  meta: {
    cwd: string | null;
    originator: string | null;
    cliVersion: string | null;
    effort: string | null;
    deviceId: string | null;
  };
  totals: Omit<SessionRow, "sessionId" | "cwd" | "originator" | "cliVersion" | "effort" | "deviceId"> & {
    models: string[];
  };
  events: {
    eventTime: string;
    model: string;
    inputTokens: number;
    cachedTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    totalTokens: number;
    costUsd: number;
    status: string | null;
    rawKey: string;
  }[];
};

const EFFORT_OPTIONS = ["low", "medium", "high", "max"] as const;
const PAGE_LIMIT = 50;

function formatCompact(value: number) {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return "$0.000";
  return `$${value.toFixed(3)}`;
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "-";
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  return `${hr}h`;
}

function formatCwd(cwd: string | null) {
  if (!cwd) return "-";
  const parts = cwd.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 2) return cwd;
  return `…/${parts.slice(-2).join("/")}`;
}

function FacetFilter({
  label,
  placeholder,
  options,
  selected,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: { value: string; count: number }[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const summary = useMemo(() => {
    if (!selected.length) return label;
    if (selected.length === 1) return selected[0];
    return `${selected.length} ${t("selected")}`;
  }, [label, selected, t]);

  const toggle = (value: string) => {
    const next = selected.includes(value)
      ? selected.filter((v) => v !== value)
      : [...selected, value];
    onChange(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 border-dashed gap-2">
          <Filter className="h-4 w-4" />
          <span className="truncate max-w-[120px]">{summary}</span>
          {selected.length > 0 ? (
            <Badge variant="secondary" className="rounded-sm px-1 font-normal">
              {selected.length}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[320px] p-0" align="start" sideOffset={8}>
        <Command className="rounded-lg border shadow-sm">
          <CommandInput placeholder={placeholder} />
          <CommandList className="max-h-[260px]">
            <CommandEmpty>{options.length ? t("noOptions") : t("loading")}</CommandEmpty>
            <CommandGroup heading={label}>
              {options.map((opt) => {
                const isSelected = selected.includes(opt.value);
                return (
                  <CommandItem
                    key={opt.value}
                    value={`${opt.value} ${opt.count}`}
                    onSelect={() => toggle(opt.value)}
                    className="flex items-center gap-2 pr-3"
                  >
                    <div
                      className={cn(
                        "mr-1 flex h-4 w-4 items-center justify-center rounded-sm border",
                        isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-muted-foreground/40"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <span className="truncate flex-1">{opt.value}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{opt.count}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          <div className="flex items-center justify-between border-t bg-accent/20 p-2">
            <span className="px-2 text-xs text-muted-foreground">
              {selected.length > 0 ? `${t("selected")} ${selected.length}` : t("filtersNone")}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs hover:bg-accent hover:text-accent-foreground"
                onClick={() => onChange(options.map((o) => o.value))}
                disabled={!options.length}
              >
                {t("all")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => onChange([])}
                disabled={!selected.length}
              >
                {t("clear")}
              </Button>
            </div>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function SessionsContent({ onChangeTab }: { onChangeTab: (tab: "overview" | "sessions") => void }) {
  const { t } = useI18n();
  const {
    state: { dateRange, selectedChannels },
    actions: { setSelectedChannels },
  } = useUsageFilters();

  const from = dateRange?.from ? dateRange.from.toISOString() : undefined;
  const to = dateRange?.to ? dateRange.to.toISOString() : undefined;

  const includeCodex = selectedChannels.includes("codex");

  const [q, setQ] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [originators, setOriginators] = useState<string[]>([]);
  const [devices, setDevices] = useState<string[]>([]);
  const [efforts, setEfforts] = useState<string[]>([]);

  const [sortBy, setSortBy] = useState<"lastActivity" | "costUsd" | "totalTokens" | "durationMs" | "turns">("lastActivity");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [offset, setOffset] = useState(0);

  const [data, setData] = useState<SessionRow[] | null>(null);
  const [page, setPage] = useState<{ limit: number; offset: number; total: number }>({ limit: PAGE_LIMIT, offset: 0, total: 0 });
  const [facets, setFacets] = useState<Facets | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!includeCodex) return;
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      selectedChannels.forEach((c) => params.append("channels", c));
      models.forEach((m) => params.append("model", m));
      originators.forEach((o) => params.append("originator", o));
      devices.forEach((d) => params.append("deviceId", d));
      efforts.forEach((e) => params.append("effort", e));
      if (q.trim()) params.set("q", q.trim());
      params.set("limit", String(PAGE_LIMIT));
      params.set("offset", String(offset));
      params.set("sortBy", sortBy);
      params.set("sortDir", sortDir);
      params.set("includeFacets", "true");
      const query = params.toString();
      try {
        const res = await fetch(`/api/usage/sessions${query ? `?${query}` : ""}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = await res.json();
        setData(json.data ?? []);
        setPage(json.page ?? { limit: PAGE_LIMIT, offset, total: 0 });
        setFacets(json.facets ?? null);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        setData([]);
        setPage({ limit: PAGE_LIMIT, offset, total: 0 });
        setFacets(null);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [devices, efforts, from, includeCodex, models, offset, originators, q, selectedChannels, sortBy, sortDir, to]);

  // 重置分页：当筛选或排序变化时回到第一页
  useEffect(() => {
    setOffset(0);
  }, [q, models, originators, devices, efforts, sortBy, sortDir, from, to]);

  const totalPages = Math.max(1, Math.ceil(page.total / page.limit));
  const currentPage = Math.min(totalPages, Math.floor(page.offset / page.limit) + 1);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  useEffect(() => {
    if (!drawerOpen || !activeSessionId) return;
    const controller = new AbortController();
    const load = async () => {
      setDetailLoading(true);
      setDetailError(null);
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const query = params.toString();
      try {
        const res = await fetch(`/api/usage/sessions/${encodeURIComponent(activeSessionId)}/events${query ? `?${query}` : ""}`, { signal: controller.signal });
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        const json = await res.json();
        setDetail(json as SessionDetail);
      } catch (err) {
        if (controller.signal.aborted) return;
        setDetailError(err instanceof Error ? err.message : String(err));
        setDetail(null);
      } finally {
        if (!controller.signal.aborted) setDetailLoading(false);
      }
    };
    load();
    return () => controller.abort();
  }, [activeSessionId, drawerOpen, from, to]);

  const openDrawer = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setDrawerOpen(true);
  };

  const toggleSort = (key: typeof sortBy) => {
    if (sortBy !== key) {
      setSortBy(key);
      setSortDir("desc");
      return;
    }
    setSortDir((prev) => (prev === "desc" ? "asc" : "desc"));
  };

  if (!includeCodex) {
    return (
      <Card className="border border-border bg-card text-card-foreground shadow-lg">
        <CardHeader>
          <CardTitle>{t("gatewayOnlyEmptyTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>{t("gatewayOnlyEmptyDescription")}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => {
                setSelectedChannels(["cliproxy", "codex"]);
                onChangeTab("sessions");
              }}
            >
              {t("viewCodexSessions")}
            </Button>
            <Button
              variant="outline"
              onClick={() => onChangeTab("overview")}
            >
              {t("backToOverview")}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-[260px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("sessionsSearchPlaceholder")}
            className="pl-8 h-9"
          />
        </div>

        <FacetFilter
          label={t("model")}
          placeholder={t("searchModel")}
          options={facets?.models ?? []}
          selected={models}
          onChange={setModels}
        />
        <FacetFilter
          label={t("originator")}
          placeholder={t("searchOriginator")}
          options={facets?.originators ?? []}
          selected={originators}
          onChange={setOriginators}
        />
        <FacetFilter
          label={t("deviceId")}
          placeholder={t("searchDeviceId")}
          options={facets?.devices ?? []}
          selected={devices}
          onChange={setDevices}
        />

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 border-dashed gap-2">
              <Filter className="h-4 w-4" />
              <span className="truncate max-w-[120px]">
                {efforts.length === 1 ? efforts[0] : t("effort")}
              </span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-2" align="start" sideOffset={8}>
            <div className="grid gap-1">
              <Button
                variant={efforts.length === 0 ? "secondary" : "ghost"}
                size="sm"
                className="justify-start"
                onClick={() => setEfforts([])}
              >
                {t("all")}
              </Button>
              {EFFORT_OPTIONS.map((opt) => (
                <Button
                  key={opt}
                  variant={efforts.includes(opt) ? "secondary" : "ghost"}
                  size="sm"
                  className="justify-start"
                  onClick={() => setEfforts([opt])}
                >
                  {opt}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {loading ? t("loading") : `${page.total} ${t("sessionsTab")}`}
        </div>
      </div>

      <Card className="border border-border bg-card text-card-foreground shadow-lg">
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[1100px]">
            <TableHeader>
              <TableRow>
                <TableHead className="w-40 cursor-pointer" onClick={() => toggleSort("lastActivity")}>
                  {t("lastActivity")}
                </TableHead>
                <TableHead className="w-64">{t("sessionId")}</TableHead>
                <TableHead className="w-64">{t("cwd")}</TableHead>
                <TableHead className="w-36">{t("originator")}</TableHead>
                <TableHead className="w-36">{t("deviceId")}</TableHead>
                <TableHead className="w-44">{t("models")}</TableHead>
                <TableHead className="w-24 text-right cursor-pointer" onClick={() => toggleSort("turns")}>
                  {t("turns")}
                </TableHead>
                <TableHead className="w-52 text-right cursor-pointer" onClick={() => toggleSort("totalTokens")}>
                  {t("tokens")}
                </TableHead>
                <TableHead className="w-28 text-right cursor-pointer" onClick={() => toggleSort("costUsd")}>
                  {t("costUsd")}
                </TableHead>
                <TableHead className="w-24 text-right cursor-pointer" onClick={() => toggleSort("durationMs")}>
                  {t("duration")}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((row) => {
                const cwdLabel = formatCwd(row.cwd);
                return (
                  <TableRow
                    key={row.sessionId}
                    className="cursor-pointer hover:bg-accent/10"
                    onClick={() => openDrawer(row.sessionId)}
                  >
                    <TableCell className="text-xs tabular-nums">
                      {new Date(row.lastActivity).toLocaleString()}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-2">
                        <span className="truncate max-w-[240px]">{row.sessionId}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(row.sessionId);
                          }}
                          title={t("copy")}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs truncate max-w-[260px]" title={row.cwd ?? ""}>
                      {cwdLabel}
                    </TableCell>
                    <TableCell className="text-xs">{row.originator ?? "-"}</TableCell>
                    <TableCell className="text-xs">{row.deviceId ?? "-"}</TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-wrap gap-1">
                        {(row.models ?? []).slice(0, 4).map((m) => (
                          <Badge key={m} variant="secondary" className="px-1.5 py-0 text-[11px]">
                            {m}
                          </Badge>
                        ))}
                        {(row.models ?? []).length > 4 ? (
                          <Badge variant="outline" className="px-1.5 py-0 text-[11px]">
                            +{(row.models ?? []).length - 4}
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{formatCompact(row.turns)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">
                      <div className="flex flex-col items-end leading-tight">
                        <span className="font-medium">{formatCompact(row.totalTokens)}</span>
                        <span className="text-[10px] text-muted-foreground">
                          In {formatCompact(row.inputTokens)} · Out {formatCompact(row.outputTokens)} · C {formatCompact(row.cachedTokens)} · R {formatCompact(row.reasoningTokens)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{formatCurrency(row.costUsd)}</TableCell>
                    <TableCell className="text-xs text-right tabular-nums">{formatDuration(row.durationMs)}</TableCell>
                  </TableRow>
                );
              })}
              {data && data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-sm text-muted-foreground py-10">
                    {error ? error : t("noSessions")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        <div className="flex items-center justify-between border-t px-3 py-2 text-sm">
          <div className="text-xs text-muted-foreground">
            {currentPage} / {totalPages}
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOffset(Math.max(0, offset - PAGE_LIMIT))}
              disabled={offset === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setOffset(Math.min((totalPages - 1) * PAGE_LIMIT, offset + PAGE_LIMIT))}
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogContent
          className="fixed top-0 right-0 left-auto h-screen w-full max-w-[680px] translate-x-0 translate-y-0 rounded-none sm:rounded-l-lg overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle className="font-mono text-sm">{activeSessionId}</DialogTitle>
          </DialogHeader>
          {detailLoading ? (
            <div className="text-sm text-muted-foreground">{t("loading")}</div>
          ) : detailError ? (
            <div className="text-sm text-destructive">{detailError}</div>
          ) : detail ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">{t("totalTokens")}</div>
                  <div className="font-mono">{formatCompact(detail.totals.totalTokens)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t("costUsd")}</div>
                  <div className="font-mono">{formatCurrency(detail.totals.costUsd)}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t("turns")}</div>
                  <div className="font-mono">{detail.totals.turns}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">{t("duration")}</div>
                  <div className="font-mono">{formatDuration(detail.totals.durationMs)}</div>
                </div>
              </div>

              <div className="space-y-1 text-xs text-muted-foreground">
                <div>{t("originator")}: {detail.meta.originator ?? "-"}</div>
                <div>{t("deviceId")}: {detail.meta.deviceId ?? "-"}</div>
                <div>{t("effort")}: {detail.meta.effort ?? "-"}</div>
                <div>{t("cliVersion")}: {detail.meta.cliVersion ?? "-"}</div>
                <div title={detail.meta.cwd ?? ""}>{t("cwd")}: {detail.meta.cwd ?? "-"}</div>
              </div>

              <div>
                <div className="text-sm font-medium mb-2">{t("events")}</div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-40">{t("time")}</TableHead>
                      <TableHead className="w-48">{t("model")}</TableHead>
                      <TableHead className="text-right">{t("tokens")}</TableHead>
                      <TableHead className="text-right">{t("costUsd")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.events.map((e) => (
                      <TableRow key={e.rawKey}>
                        <TableCell className="text-xs tabular-nums">
                          {new Date(e.eventTime).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs">{e.model}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">
                          <div className="flex flex-col items-end leading-tight">
                            <span className="font-medium">{formatCompact(e.totalTokens)}</span>
                            <span className="text-[10px] text-muted-foreground">
                              In {formatCompact(e.inputTokens)} · Out {formatCompact(e.outputTokens)} · C {formatCompact(e.cachedTokens)} · R {formatCompact(e.reasoningTokens)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{formatCurrency(e.costUsd)}</TableCell>
                      </TableRow>
                    ))}
                    {detail.events.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                          {t("noEvents")}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-foreground">{t("noSessions")}</div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
