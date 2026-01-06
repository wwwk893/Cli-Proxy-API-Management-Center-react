"use client";

import { Check, Filter } from "lucide-react";
import type { EffortFilterValue } from "@/lib/usage/model-normalize";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function labelForEffort(value: EffortFilterValue, locale?: string) {
  const isZh = locale?.toLowerCase().startsWith("zh");
  if (value === "unspecified") return isZh ? "未标注" : "Unspecified";
  return value;
}

export function EffortFilter({
  value,
  onChange,
  disabled,
  locale,
  className,
}: {
  value: EffortFilterValue[];
  onChange: (next: EffortFilterValue[]) => void;
  disabled?: boolean;
  locale?: string;
  className?: string;
}) {
  const isZh = locale?.toLowerCase().startsWith("zh");
  const label = isZh ? "Effort" : "Effort";
  const allLabel = isZh ? "全部" : "All";
  const clearLabel = isZh ? "清除" : "Clear";

  const set = new Set(value);
  const selectedCount = set.size;
  const summary =
    selectedCount === 0
      ? allLabel
      : selectedCount === 1
        ? labelForEffort(value[0], locale)
        : `${selectedCount}`;

  const toggle = (nextValue: EffortFilterValue) => {
    const next = new Set(value);
    if (next.has(nextValue)) next.delete(nextValue);
    else next.add(nextValue);
    onChange(Array.from(next));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-8 gap-2", className)}
          disabled={disabled}
          title={disabled ? (isZh ? "原始模型视图下不可用" : "Disabled in raw view") : undefined}
        >
          <Filter className="h-4 w-4" />
          <span className="truncate max-w-[140px]">{label}: {summary}</span>
          {selectedCount > 1 ? (
            <Badge variant="secondary" className="rounded-sm px-1 font-normal">
              {selectedCount}
            </Badge>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className="w-56">
        <DropdownMenuLabel className="text-xs">{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm",
            "hover:bg-accent hover:text-accent-foreground",
          )}
          onClick={() => onChange([])}
        >
          <span className="inline-flex h-4 w-4 items-center justify-center">
            {selectedCount === 0 ? <Check className="h-4 w-4" /> : null}
          </span>
          {allLabel}
        </button>
        <DropdownMenuSeparator />
        {(["low", "medium", "high", "xhigh", "unspecified"] as const).map((effort) => (
          <DropdownMenuCheckboxItem
            key={effort}
            checked={set.has(effort)}
            onCheckedChange={() => toggle(effort)}
          >
            {labelForEffort(effort, locale)}
          </DropdownMenuCheckboxItem>
        ))}
        <DropdownMenuSeparator />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-full justify-start px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onChange([])}
          disabled={selectedCount === 0}
        >
          {clearLabel}
        </Button>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

