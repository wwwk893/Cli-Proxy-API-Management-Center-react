"use client";

import { Inbox } from "lucide-react";
import { useI18n } from "@/components/i18n-context";

export function LogsEmptyState() {
  const { t } = useI18n();
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2 text-muted-foreground">
      <Inbox className="h-10 w-10" />
      <div className="text-sm">{t("logs.empty.title")}</div>
      <div className="text-xs">{t("logs.empty.description")}</div>
    </div>
  );
}
