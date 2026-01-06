"use client";

import { useMemo, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-context";
import { resolveModelColor } from "@/lib/model-colors";
import { normalizeModel } from "@/lib/usage/model-normalize";

export type ModelOption = {
  id: string;
  description?: string;
};

type Props = {
  selectedModels: string[];
  models: ModelOption[];
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onChangeModels: (value: string[]) => void;
  modelColorMap?: Record<string, string>;
};

export function FilterPopover({ selectedModels, models, loading, error, onRetry, onChangeModels, modelColorMap }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { t } = useI18n();

  const hasSelection = selectedModels.length > 0;

  const canonicalEffortMap = useMemo(() => {
    const map = new Map<string, Set<string>>();
    models.forEach((m) => {
      const normalized = normalizeModel({ model: m.id });
      if (!normalized.effort) return;
      const set = map.get(normalized.modelCanonical) ?? new Set<string>();
      set.add(normalized.effort);
      map.set(normalized.modelCanonical, set);
    });
    return map;
  }, [models]);

  const filteredModels = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return models;
    const effortTerm = (["low", "medium", "high", "xhigh"] as const).find((level) => term.includes(level));
    return models.filter((m) => {
      const idMatch = m.id.toLowerCase().includes(term);
      const descMatch = m.description?.toLowerCase().includes(term);
      if (idMatch || !!descMatch) return true;

      // 搜索增强：输入 “high/low/...” 时，允许命中其 canonical 父项（若存在该 effort 变体）
      // 例：models 中有 gpt-5.2-high，则搜索 high 时也能看到 gpt-5.2
      if (!effortTerm) return false;
      const normalized = normalizeModel({ model: m.id });
      if (normalized.modelCanonical !== m.id) return false; // 只对 canonical 父项生效
      return canonicalEffortMap.get(normalized.modelCanonical)?.has(effortTerm) ?? false;
    });
  }, [canonicalEffortMap, models, search]);

  const clear = () => {
    setSearch("");
    onChangeModels([]);
    setOpen(false);
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setSearch("");
  };

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "gap-2 rounded-full border border-border/40 bg-muted/40 px-3 text-xs font-medium text-muted-foreground",
            "hover:bg-muted/70 hover:text-foreground",
          )}
          disabled={loading && !open}
        >
          <Filter className="h-4 w-4" />
          <span className="hidden sm:inline-block text-xs font-medium">
            {hasSelection
              ? selectedModels.length === 1
                ? `${t("model")} · ${selectedModels[0]}`
                : `${t("model")} · ${selectedModels.length} ${t("models")}`
              : t("filters")}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-80 space-y-3 rounded-2xl border border-border/60 bg-popover/95 backdrop-blur"
        align="end"
      >
        <DropdownMenuItem asChild>
          <div className="flex w-full items-center justify-between px-0">
            <div className="text-sm font-medium text-foreground flex items-center gap-2">
              <span>{t("model")}</span>
              {loading && <span className="text-[11px] text-muted-foreground">{t("loadingModels")}</span>}
            </div>
            {hasSelection && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  clear();
                }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" /> {t("clear")}
              </button>
            )}
          </div>
        </DropdownMenuItem>

        <div className="px-2">
          <Input
            placeholder={t("searchModel")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="bg-muted/50 border-border text-xs"
          />
        </div>

        <div className="px-2">
          {error ? (
            <div className="flex flex-col gap-2 rounded-md bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <span className="truncate">{t("modelsLoadError")}</span>
              {onRetry && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="self-start text-[11px] font-medium text-destructive underline-offset-2 hover:underline"
                >
                  {t("retry")}
                </button>
              )}
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto rounded-md border border-border/60 bg-muted/30">
              {filteredModels.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                  {t("noModels")}
                </div>
              ) : (
                <div className="py-1">
                  {filteredModels.map((m) => {
                    const active = selectedModels.includes(m.id);
                  const dotColor = resolveModelColor(m.id, modelColorMap);
                    return (
                      <button
                        key={m.id}
                        type="button"
                        className={cn(
                          "flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs",
                          "hover:bg-accent/40",
                          active && "bg-accent/60 text-accent-foreground",
                        )}
                        onClick={() => {
                          const exists = selectedModels.includes(m.id);
                          const next = exists
                            ? selectedModels.filter((id) => id !== m.id)
                            : [...selectedModels, m.id];
                          onChangeModels(next);
                        }}
                      >
                        <span
                          className="mt-[3px] h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: dotColor }}
                        />
                        <span className="flex-1">
                          <span className="block font-mono text-[11px] font-medium leading-snug truncate">{m.id}</span>
                          {m.description && (
                            <span className="mt-0.5 block text-[11px] text-muted-foreground line-clamp-2">
                              {m.description}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <DropdownMenuSeparator />
        <div className="flex justify-end gap-2 px-2 pb-2">
          <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
            {t("cancel")}
          </Button>
          <Button size="sm" onClick={() => setOpen(false)} disabled={loading}>
            {t("apply")}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
