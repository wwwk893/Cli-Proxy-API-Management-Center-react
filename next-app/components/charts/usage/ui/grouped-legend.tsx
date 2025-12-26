"use client";

import { cn } from "@/lib/utils";
import { useI18n } from "@/components/i18n-context";

type LegendGroup = {
  sourceId: string;
  sourceLabel: string;
  items: { id: string; label: string; color: string }[];
};

type Props = {
  groups: LegendGroup[];
  visibleSet: Set<string>;
  onToggle: (id: string) => void;
  onToggleGroup: (sourceId: string, childIds: string[]) => void;
  total: number;
};

export function GroupedLegend({ groups, visibleSet, onToggle, onToggleGroup, total }: Props) {
  const { t } = useI18n();
  if (!groups.length) return null;

  const isActive = (id: string) => visibleSet.size === 0 || visibleSet.has(id);

  return (
    <div className="mt-3 w-full rounded-xl border border-border/40 bg-muted/10 p-3 shadow-inner">
      <div className="mb-2 flex items-center justify-between text-[10px] uppercase tracking-wide text-muted-foreground">
        <span className="font-semibold">{t("source") ?? "Source"}</span>
        <span className="text-muted-foreground/70">{total}</span>
      </div>
      <div className="max-h-44 space-y-2 overflow-y-auto pr-1 [\&::-webkit-scrollbar]:w-1.5 [\&::-webkit-scrollbar-track]:bg-transparent [\&::-webkit-scrollbar-thumb]:rounded-full [\&::-webkit-scrollbar-thumb]:bg-muted-foreground/20 [\&::-webkit-scrollbar-thumb]:hover:bg-muted-foreground/40">
        {groups.map((group) => {
          const childStates = group.items.map((item) => isActive(item.id));
          const allActive = childStates.every(Boolean);
          const anyActive = childStates.some(Boolean);
          const indeterminate = anyActive && !allActive;

          return (
            <div key={group.sourceId} className="rounded-lg border border-border/40 bg-card/60 p-2 shadow-sm">
              <button
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1 text-sm font-semibold transition-colors",
                  allActive ? "text-card-foreground" : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => onToggleGroup(group.sourceId, group.items.map((item) => item.id))}
              >
                <span className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-sm border",
                      allActive && "bg-primary text-primary-foreground border-primary",
                      indeterminate && "bg-muted text-muted-foreground border-border",
                    )}
                  >
                    {allActive ? "✓" : indeterminate ? "–" : ""}
                  </span>
                  <span className="truncate" title={group.sourceLabel}>{group.sourceLabel}</span>
                </span>
                <span className="text-[11px] text-muted-foreground">{group.items.length}</span>
              </button>

              <div className="mt-2 space-y-1">
                {group.items.map((item) => {
                  const active = isActive(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1 text-[12px] transition-colors",
                        active ? "text-card-foreground" : "text-muted-foreground hover:text-foreground",
                      )}
                      onClick={() => onToggle(item.id)}
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="truncate" title={item.label}>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
