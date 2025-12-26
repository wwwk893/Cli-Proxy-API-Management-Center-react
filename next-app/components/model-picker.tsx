"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { buildModelColorMap, resolveModelColor } from "@/lib/model-colors";

export type ModelOption = {
  id: string;
  name?: string;
  provider?: string;
};

type Props = {
  value?: string;
  onChange: (value: string) => void;
  options: ModelOption[];
  configuredIds?: string[];
  loading?: boolean;
  error?: string | null;
  disabled?: boolean;
};

export function ModelPicker({ value, onChange, options, configuredIds = [], loading, error, disabled }: Props) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");

  const colorMap = React.useMemo(() => buildModelColorMap(options.map((opt) => opt.id)), [options]);
  const isConfigured = (id: string) => configuredIds.includes(id);

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return options;
    return options.filter((opt) => opt.id.toLowerCase().includes(term) || (opt.name ?? "").toLowerCase().includes(term));
  }, [options, search]);

  const trimmedSearch = search.trim();
  const lowerSearch = trimmedSearch.toLowerCase();
  const hasExactMatch = React.useMemo(() => {
    if (!lowerSearch) return false;
    return options.some(
      (opt) => opt.id.toLowerCase() === lowerSearch || (opt.name ?? "").toLowerCase() === lowerSearch,
    );
  }, [options, lowerSearch]);
  const canCreate = trimmedSearch.length > 0 && !hasExactMatch;
  const createSelected = value === trimmedSearch;
  const createConfigured = canCreate && isConfigured(trimmedSearch);
  const createDisabled = createConfigured && !createSelected;

  const selected = options.find((opt) => opt.id === value) ?? (value ? { id: value, name: value } : undefined);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} disabled={disabled} className="w-full justify-between">
          {selected ? (
            <span className="flex items-center gap-2 truncate text-left">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: resolveModelColor(selected.id, colorMap) }}
              />
              {selected.name && selected.name !== selected.id ? (
                <>
                  <span className="font-medium truncate">{selected.name}</span>
                  <span className="font-mono text-xs text-muted-foreground ml-2">{selected.id}</span>
                </>
              ) : (
                <span className="font-mono text-sm truncate">{selected.id}</span>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">选择模型</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[420px] p-0" align="start">
        <div className="p-2 border-b border-border">
          <Input
            placeholder="搜索模型"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 text-sm"
          />
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> 正在加载模型...
            </div>
          ) : error ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          ) : (
            <>
              {canCreate ? (
                <button
                  type="button"
                  disabled={createDisabled}
                  onClick={() => {
                    onChange(trimmedSearch);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors border-b border-border",
                    createDisabled ? "text-muted-foreground/70 cursor-not-allowed" : "hover:bg-muted",
                    createSelected && "bg-muted/70",
                  )}
                >
                  <Check className={cn("h-4 w-4", createSelected ? "opacity-100" : "opacity-0")} />
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: resolveModelColor(trimmedSearch, colorMap) }}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">使用自定义模型</span>
                    <span className="text-xs text-muted-foreground font-mono truncate">{trimmedSearch}</span>
                  </div>
                  {createConfigured && !createSelected && (
                    <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">已配置</span>
                  )}
                </button>
              ) : null}
              {filtered.length === 0 ? (
                canCreate ? null : <div className="py-6 text-center text-sm text-muted-foreground">未找到匹配的模型</div>
              ) : (
                filtered.map((opt, idx) => {
                  const selectedItem = value === opt.id;
                  const configured = isConfigured(opt.id);
                  const disabledItem = configured && !selectedItem;
                  const color = resolveModelColor(opt.id, colorMap, idx);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={disabledItem}
                      onClick={() => {
                        onChange(opt.id);
                        setOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                        disabledItem ? "text-muted-foreground/70 cursor-not-allowed" : "hover:bg-muted",
                        selectedItem && "bg-muted/70",
                      )}
                    >
                      <Check className={cn("h-4 w-4", selectedItem ? "opacity-100" : "opacity-0")} />
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="truncate">{opt.name && opt.name !== opt.id ? opt.name : opt.id}</span>
                        {opt.name && opt.name !== opt.id ? (
                          <span className="text-xs text-muted-foreground font-mono truncate">{opt.id}</span>
                        ) : null}
                      </div>
                      {opt.provider && <span className="text-[11px] text-muted-foreground">{opt.provider}</span>}
                      {configured && !selectedItem && (
                        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">已配置</span>
                      )}
                    </button>
                  );
                })
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
