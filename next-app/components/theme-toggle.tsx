'use client';

import { Moon, Sun, Laptop } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useThemeMode } from "@/components/theme-context";

export function ThemeToggle() {
  const { theme, setTheme } = useThemeMode();

  const cycle = () => {
    if (theme === "day") setTheme("night");
    else if (theme === "night") setTheme("system");
    else setTheme("day");
  };

  const icon =
    theme === "day" ? <Sun className="h-4 w-4" /> : theme === "night" ? (
      <Moon className="h-4 w-4" />
    ) : (
      <Laptop className="h-4 w-4" />
    );

  const label = theme === "day" ? "Switch to night" : theme === "night" ? "Follow system" : "Switch to day";

  return (
    <Button variant="ghost" size="icon" onClick={cycle} aria-label={label}>
      {icon}
    </Button>
  );
}
