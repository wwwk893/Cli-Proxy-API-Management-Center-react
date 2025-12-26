import {
  Bot,
  Globe,
  Hash,
  LayoutTemplate,
  Sparkles,
  Terminal,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// A small, fixed palette distinct from model colors (blue/purple leaning, good in light/dark)
const SOURCE_COLORS = [
  "#6366f1", // indigo-500
  "#8b5cf6", // violet-500
  "#a855f7", // purple-500
  "#14b8a6", // teal-500
  "#0ea5e9", // sky-500
  "#f59e0b", // amber-500 (fallback/others)
];

const iconMap: Record<string, LucideIcon> = {
  "web-ui": LayoutTemplate,
  web: Globe,
  cli: Terminal,
  automation: Workflow,
  api: Bot,
  agent: Sparkles,
};

export function getSourceColor(source?: string | null): string {
  if (!source) return SOURCE_COLORS[SOURCE_COLORS.length - 1];
  const normalized = source.toLowerCase();
  const hash = [...normalized].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const idx = hash % SOURCE_COLORS.length;
  return SOURCE_COLORS[idx];
}

export function getSourceIcon(source?: string | null): LucideIcon {
  if (!source) return Hash;
  const normalized = source.toLowerCase();
  if (iconMap[normalized]) return iconMap[normalized];
  if (normalized.startsWith("agent")) return Sparkles;
  if (normalized.includes("cli")) return Terminal;
  if (normalized.includes("web")) return Globe;
  if (normalized.includes("auto")) return Workflow;
  if (normalized.includes("api")) return Bot;
  return Hash;
}

export function formatSourceLabel(source?: string | null) {
  if (!source) return "Unknown";
  return source;
}
