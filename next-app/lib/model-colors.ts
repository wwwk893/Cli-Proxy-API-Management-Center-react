// Expanded distinct palette for per-model identity colors
const MODEL_COLOR_PALETTE = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ef4444", // red
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#22c55e", // green
  "#f97316", // orange
  "#6366f1", // indigo
];

const DEFAULT_COLOR = "var(--chart-1)";

function hashModelId(modelId: string): number {
  if (!modelId) return 0;
  let hash = 0;
  for (let i = 0; i < modelId.length; i += 1) {
    hash = (hash << 5) - hash + modelId.charCodeAt(i);
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export function getModelColor(modelId: string, indexHint?: number): string {
  const key = modelId?.trim?.() ?? "";
  if (typeof indexHint === "number" && MODEL_COLOR_PALETTE[indexHint % MODEL_COLOR_PALETTE.length]) {
    return MODEL_COLOR_PALETTE[indexHint % MODEL_COLOR_PALETTE.length];
  }
  const hash = hashModelId(key);
  return MODEL_COLOR_PALETTE[hash % MODEL_COLOR_PALETTE.length] ?? DEFAULT_COLOR;
}

export function getModelPalette() {
  return MODEL_COLOR_PALETTE.slice();
}

export function buildModelColorMap(models: string[]) {
  const unique = Array.from(new Set(models.map((id) => id?.trim?.()).filter(Boolean) as string[]));
  unique.sort();
  return unique.reduce((acc, id, idx) => {
    acc[id] = getModelColor(id, idx);
    return acc;
  }, {} as Record<string, string>);
}

export function resolveModelColor(modelId: string, colorMap?: Record<string, string>, indexHint?: number) {
  const key = modelId?.trim?.() ?? "";
  if (key && colorMap?.[key]) return colorMap[key];
  return getModelColor(key, indexHint);
}

export function toAlphaColor(color: string, alpha: number) {
  const clamped = Math.max(0, Math.min(1, alpha));
  const hexMatch = /^#([A-Fa-f0-9]{6})$/.exec(color);
  if (!hexMatch) return color;
  const hex = hexMatch[1];
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${clamped.toFixed(2)})`;
}
