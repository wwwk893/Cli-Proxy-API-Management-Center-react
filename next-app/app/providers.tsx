'use client';

import React from "react";
import { ThemeProvider } from "@/components/theme-context";
import { I18nProvider } from "@/components/i18n-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <I18nProvider>{children}</I18nProvider>
    </ThemeProvider>
  );
}
