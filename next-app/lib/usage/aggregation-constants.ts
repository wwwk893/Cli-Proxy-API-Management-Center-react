export const AGGREGATION_CHANNELS = ["cliproxy", "codex", "opencode"] as const;
export type AggregationChannel = (typeof AGGREGATION_CHANNELS)[number];

export const CODEX_API_PATHS = ["codex-cli", "codex"] as const;
export const OPENCODE_API_PATHS = ["opencode-cli", "opencode"] as const;
export const CLI_API_PATHS = [...CODEX_API_PATHS, ...OPENCODE_API_PATHS] as const;
