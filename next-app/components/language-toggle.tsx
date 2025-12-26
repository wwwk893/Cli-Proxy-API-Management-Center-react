'use client';

import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/i18n-context";

export function LanguageToggle() {
  const { locale, setLocale } = useI18n();
  const next = locale === "en" ? "zh" : "en";
  const label = locale === "en" ? "EN" : "中";

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLocale(next)}
      aria-label="Toggle language"
      className="text-muted-foreground hover:text-foreground px-2"
    >
      {label}
    </Button>
  );
}
