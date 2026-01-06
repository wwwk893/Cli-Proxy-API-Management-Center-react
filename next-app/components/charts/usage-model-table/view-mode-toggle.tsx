"use client";

import { AlertTriangle } from "lucide-react";
import type { UsageModelGroupBy } from "@/lib/usage/model-normalize";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function ViewModeToggle({
  value,
  onChange,
  locale,
  className,
}: {
  value: UsageModelGroupBy;
  onChange: (next: UsageModelGroupBy) => void;
  locale?: string;
  className?: string;
}) {
  const isZh = locale?.toLowerCase().startsWith("zh");
  const label = isZh ? "视图" : "View";
  const options: Array<{ key: UsageModelGroupBy; text: string; icon?: React.ReactNode }> = [
    { key: "canonical", text: isZh ? "基础模型" : "Base model" },
    { key: "canonical_effort", text: isZh ? "基础模型+Effort" : "Base + Effort" },
    { key: "raw", text: isZh ? "原始模型" : "Raw", icon: <AlertTriangle className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className="text-xs text-muted-foreground">{label}:</span>
      <div className="inline-flex items-center rounded-full border border-border/60 bg-muted/20 p-0.5">
        {options.map((opt) => {
          const active = value === opt.key;
          return (
            <Button
              key={opt.key}
              type="button"
              size="sm"
              variant={active ? "secondary" : "ghost"}
              className={cn(
                "h-7 rounded-full px-3 text-xs",
                opt.key === "raw" && !active && "text-amber-600 dark:text-amber-400",
                opt.key === "raw" && active && "bg-amber-200/70 text-amber-950 dark:bg-amber-900/40 dark:text-amber-100",
              )}
              onClick={() => onChange(opt.key)}
            >
              {opt.icon ? <span className="mr-1 inline-flex items-center">{opt.icon}</span> : null}
              {opt.text}
            </Button>
          );
        })}
      </div>
    </div>
  );
}

