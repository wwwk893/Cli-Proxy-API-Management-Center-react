"use client";

import { AlertTriangle, RefreshCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-context";

type LogsErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export function LogsErrorState({ message, onRetry }: LogsErrorStateProps) {
  const { t } = useI18n();
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-6 text-destructive">
      <AlertTriangle className="h-10 w-10" />
      <div className="text-sm font-semibold">{t("logs.error.title")}</div>
      <div className="text-xs text-destructive/80 max-w-md text-center">{message}</div>
      <Button variant="outline" size="sm" onClick={onRetry} className="gap-2 border-destructive/60 text-destructive">
        <RefreshCcw className="h-4 w-4" />
        {t("logs.error.retry")}
      </Button>
    </div>
  );
}
