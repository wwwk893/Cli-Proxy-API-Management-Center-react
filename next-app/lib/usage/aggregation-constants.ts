export const AGGREGATION_CHANNELS = ["cliproxy", "codex"] as const;
export type AggregationChannel = (typeof AGGREGATION_CHANNELS)[number];

export const CODEX_API_PATHS = ["codex-cli", "codex"] as const;
