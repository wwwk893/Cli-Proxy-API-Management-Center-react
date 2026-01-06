export const EFFORT_LEVELS = ["low", "medium", "high", "xhigh"] as const;
export type EffortLevel = typeof EFFORT_LEVELS[number];
export type EffortOrNull = EffortLevel | null;

// UI 里“未标注”需要一个可序列化值
export type EffortFilterValue = EffortLevel | "unspecified"; // "unspecified" <-> null

export const USAGE_MODEL_GROUP_BY = ["canonical", "canonical_effort", "raw"] as const;
export type UsageModelGroupBy = typeof USAGE_MODEL_GROUP_BY[number];

export type NormalizeModelInput = {
  model: string;
  effort?: string | null;
};

export type NormalizeModelResult = {
  modelRaw: string;
  modelCanonical: string;
  effort: EffortOrNull;
  effortSource: "explicit" | "suffix" | "none" | "explicit_invalid" | "mismatch";
  warnings: string[];
};

function normalizeEffort(value: string | null | undefined): EffortLevel | null {
  if (!value) return null;
  const lowered = value.trim().toLowerCase();
  if (!lowered) return null;
  return (EFFORT_LEVELS as readonly string[]).includes(lowered) ? (lowered as EffortLevel) : null;
}

function parseEffortSuffix(modelRaw: string): { canonical: string; effort: EffortLevel | null; matched: boolean; suffix: string } {
  const trimmed = modelRaw.trim();
  if (!trimmed) return { canonical: trimmed, effort: null, matched: false, suffix: "" };

  // Only parse at the very end:
  // - `-(low|medium|high|xhigh)`
  // - `(low|medium|high|xhigh)`
  // Note: `-max` is NOT an effort level, and won't match.
  const match = trimmed.match(/(?:-(low|medium|high|xhigh)|\((low|medium|high|xhigh)\))$/i);
  if (!match) return { canonical: trimmed, effort: null, matched: false, suffix: "" };

  const effort = normalizeEffort(match[1] ?? match[2] ?? "");
  if (!effort) return { canonical: trimmed, effort: null, matched: false, suffix: "" };

  const suffix = match[0];
  const canonical = trimmed.slice(0, trimmed.length - suffix.length).trimEnd();
  return { canonical: canonical || trimmed, effort, matched: true, suffix };
}

export function normalizeModel(input: NormalizeModelInput): NormalizeModelResult {
  const warnings: string[] = [];

  const modelRawInput = (input.model ?? "").trim();
  const modelRaw = modelRawInput || "unknown";

  const parsed = parseEffortSuffix(modelRaw);
  const explicitEffort = normalizeEffort(input.effort);
  const hasExplicit = typeof input.effort === "string" && input.effort.trim().length > 0;

  const modelCanonical = (parsed.matched ? parsed.canonical : modelRaw).trim() || modelRaw;

  if (explicitEffort) {
    if (parsed.matched && parsed.effort && parsed.effort !== explicitEffort) {
      warnings.push(`effort_mismatch: explicit=${explicitEffort}, suffix=${parsed.effort}`);
      return {
        modelRaw,
        modelCanonical,
        effort: explicitEffort,
        effortSource: "mismatch",
        warnings,
      };
    }
    return {
      modelRaw,
      modelCanonical,
      effort: explicitEffort,
      effortSource: "explicit",
      warnings,
    };
  }

  if (hasExplicit) {
    warnings.push(`effort_unrecognized: explicit=${input.effort!.trim()}`);
    return {
      modelRaw,
      modelCanonical,
      effort: parsed.effort,
      effortSource: "explicit_invalid",
      warnings,
    };
  }

  if (parsed.matched && parsed.effort) {
    return {
      modelRaw,
      modelCanonical,
      effort: parsed.effort,
      effortSource: "suffix",
      warnings,
    };
  }

  return {
    modelRaw,
    modelCanonical,
    effort: null,
    effortSource: "none",
    warnings,
  };
}
