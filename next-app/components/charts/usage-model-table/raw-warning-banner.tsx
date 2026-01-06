"use client";

import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function RawWarningBanner({
  locale,
  onBackToDefault,
  className,
}: {
  locale?: string;
  onBackToDefault: () => void;
  className?: string;
}) {
  const isZh = locale?.toLowerCase().startsWith("zh");
  const title = isZh ? "原始模型视图：显示未规范化的 modelRaw，仅用于排错。" : "Raw model view: showing modelRaw (debug only).";
  const backLabel = isZh ? "返回默认视图" : "Back to default";

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950",
        "dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-100",
        className,
      )}
      role="note"
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-4 w-4 text-amber-600 dark:text-amber-400" />
        <p className="text-xs leading-relaxed">{title}</p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs border-amber-300/80 hover:bg-amber-100 dark:border-amber-800/60 dark:hover:bg-amber-900/20"
        onClick={onBackToDefault}
      >
        {backLabel}
      </Button>
    </div>
  );
}

