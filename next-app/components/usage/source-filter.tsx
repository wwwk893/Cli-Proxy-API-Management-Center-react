"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { formatSourceLabel, getSourceColor, getSourceIcon } from "@/lib/source-utils";
import { useI18n } from "@/components/i18n-context";

type SourceSummary = {
  source: string | null;
  totalTokens: number;
  cachedTokens: number;
  costUsd: number;
  requestCount: number;
};

type Props = {
  selected: string[];
  onChange: (next: string[]) => void;
  from?: string | null;
  to?: string | null;
  channels?: string[];
};

const formatCompact = (value: number) => {
  if (!Number.isFinite(value)) return "-";
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
};

export function SourceFilter({ selected, onChange, from, to, channels = [] }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<SourceSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      // 仅对网关来源有效，但仍按全局 channels 过滤以避免误导
      channels.forEach((c) => params.append("channels", c));
      const res = await fetch(`/api/usage/sources${params.toString() ? `?${params.toString()}` : ""}`, {
        signal: controller.signal,
      });
      if (!res.ok) return;
      const json = await res.json();
      setOptions(json.data ?? []);
      setLoading(false);
    };
    load().catch(() => setLoading(false));
    return () => controller.abort();
  }, [channels, from, to]);

  const label = useMemo(() => {
    if (!selected.length) return "提供商";
    if (selected.length === 1) return formatSourceLabel(selected[0]);
    return `${selected.length} selected`;
  }, [selected]);

  const toggle = (source: string) => {
    const next = selected.includes(source)
      ? selected.filter((s) => s !== source)
      : [...selected, source];
    onChange(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 border-dashed gap-2"
          title={t("authSourceTooltip")}
        >
          <Filter className="h-4 w-4" />
          <span className="truncate max-w-[140px]">{label}</span>
          {selected.length > 0 ? (
            <Badge variant="secondary" className="rounded-sm px-1 font-normal">
              {selected.length}
            </Badge>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0" align="end" sideOffset={8}>
        <Command className="rounded-lg border shadow-sm">
          <CommandInput placeholder="搜索提供商..." />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>{loading ? "Loading..." : "No sources found."}</CommandEmpty>
            <CommandGroup heading="Sources">
              {options.map((opt) => {
                const sourceId = opt.source ?? "";
                const isSelected = selected.includes(sourceId);
                const Icon = getSourceIcon(sourceId);
                const color = getSourceColor(sourceId);
                return (
                  <CommandItem
                    key={sourceId}
                    value={`${formatSourceLabel(sourceId)} ${sourceId}`}
                    onSelect={() => toggle(sourceId)}
                    className="flex items-center gap-2 pr-4"
                  >
                    <div
                      className={cn(
                        "mr-1 flex h-4 w-4 items-center justify-center rounded-sm border",
                        isSelected ? "bg-primary text-primary-foreground border-primary" : "border-muted-foreground/40"
                      )}
                    >
                      {isSelected && <Check className="h-3 w-3" />}
                    </div>
                    <Icon className="h-4 w-4 shrink-0" style={{ color }} />
                    <span className="truncate flex-1" title={formatSourceLabel(sourceId)}>
                      {formatSourceLabel(sourceId)}
                    </span>
                    <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
                      <span className="min-w-[3rem] text-right">{opt.requestCount} req</span>
                      <span className="min-w-[3.5rem] text-right">{formatCompact(opt.totalTokens)} tok</span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          <div className="flex items-center justify-between border-t bg-accent/20 p-2">
            <span className="px-2 text-xs text-muted-foreground">
              {selected.length > 0 ? `已选 ${selected.length} 个` : "未选择"}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs hover:bg-accent hover:text-accent-foreground"
                onClick={() => onChange(options.map((o) => o.source ?? ""))}
                disabled={!options.length}
              >
                全选
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => onChange([])}
                disabled={!selected.length}
              >
                清除
              </Button>
            </div>
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
