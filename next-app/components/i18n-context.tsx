'use client';

import React, { createContext, useContext, useMemo, useState, useEffect } from "react";
import messagesEnBase from "./i18n/messages/en";
import messagesZhBase from "./i18n/messages/zh";
import messagesEnDashboard from "./i18n/messages/en.dashboard";
import messagesZhDashboard from "./i18n/messages/zh.dashboard";

type Locale = "en" | "zh";

const messagesEn = { ...messagesEnBase, ...messagesEnDashboard };
const messagesZh = { ...messagesZhBase, ...messagesZhDashboard };

const messages: Record<Locale, Record<string, string>> = {
  en: messagesEn,
  zh: messagesZh,
};

type I18nCtx = {
  locale: Locale;
  t: (key: string) => string;
  setLocale: (loc: Locale) => void;
};

const I18nContext = createContext<I18nCtx | undefined>(undefined);

function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
  const stored = localStorage.getItem("ui-locale");
  if (stored === "en" || stored === "zh") return stored;
  const nav = navigator.language.toLowerCase();
  return nav.startsWith("zh") ? "zh" : "en";
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => detectLocale());

  useEffect(() => {
    localStorage.setItem("ui-locale", locale);
  }, [locale]);

  const setLocale = (loc: Locale) => setLocaleState(loc);

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: (key: string) => messages[locale]?.[key] ?? key,
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
