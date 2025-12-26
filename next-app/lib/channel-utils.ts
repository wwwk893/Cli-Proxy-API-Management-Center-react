import { Globe, Terminal, Hash } from "lucide-react";
import type { LucideIcon } from "lucide-react";

// Channel（来源渠道）= 请求入口：Cliproxy Gateway / Codex CLI
// 颜色采用固定搭配，避免与模型色/提供商色混淆。
const CHANNEL_COLORS: Record<string, string> = {
  cliproxy: "#0ea5e9", // sky-500
  codex: "#22c55e", // green-500
};

const CHANNEL_ICONS: Record<string, LucideIcon> = {
  cliproxy: Globe,
  codex: Terminal,
};

export function getChannelColor(channel?: string | null): string {
  if (!channel) return "var(--muted-foreground)";
  return CHANNEL_COLORS[channel.toLowerCase()] ?? "var(--muted-foreground)";
}

export function getChannelIcon(channel?: string | null): LucideIcon {
  if (!channel) return Hash;
  return CHANNEL_ICONS[channel.toLowerCase()] ?? Hash;
}

export function formatChannelLabel(channel?: string | null) {
  if (!channel) return "Unknown";
  const normalized = channel.toLowerCase();
  if (normalized === "cliproxy") return "Cliproxy Gateway";
  if (normalized === "codex") return "Codex CLI";
  return channel;
}

