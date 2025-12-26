'use client';

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type ThemeMode = "day" | "night" | "system";

type ThemeContextValue = {
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function resolveSystemTheme() {
  if (typeof window === "undefined") return "night";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "night" : "day";
}

function applyBodyClass(mode: ThemeMode) {
  if (typeof document === "undefined") return;
  const classList = document.body.classList;
  classList.remove("theme-day", "theme-night");
  const target = mode === "system" ? resolveSystemTheme() : mode;
  classList.add(target === "day" ? "theme-day" : "theme-night");
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window === "undefined") return "system";
    const stored = localStorage.getItem("theme-mode") as ThemeMode | null;
    return stored ?? "system";
  });

  useEffect(() => {
    applyBodyClass(theme);
  }, [theme]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const stored = localStorage.getItem("theme-mode") as ThemeMode | null;
      if (!stored || stored === "system") {
        applyBodyClass("system");
      }
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  const setTheme = (mode: ThemeMode) => {
    localStorage.setItem("theme-mode", mode);
    setThemeState(mode);
    applyBodyClass(mode);
  };

  const value = useMemo(() => ({ theme, setTheme }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useThemeMode must be used within ThemeProvider");
  return ctx;
}
