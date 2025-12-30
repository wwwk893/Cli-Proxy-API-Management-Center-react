export type OAuthProvider =
  | "codex"
  | "anthropic"
  | "antigravity"
  | "gemini-cli"
  | "qwen"
  | "iflow";

export type OAuthPhase =
  | "idle"
  | "generating"
  | "polling"
  | "success"
  | "error"
  | "timeout";

export type ProviderConfig = {
  id: OAuthProvider;
  labelKey: string;
  supportsUrl: boolean;
  supportsCookie: boolean;
};

export const OAUTH_PROVIDER_CONFIGS: ProviderConfig[] = [
  { id: "codex", labelKey: "oauth.providers.codex", supportsUrl: true, supportsCookie: false },
  { id: "anthropic", labelKey: "oauth.providers.anthropic", supportsUrl: true, supportsCookie: false },
  { id: "antigravity", labelKey: "oauth.providers.antigravity", supportsUrl: true, supportsCookie: false },
  { id: "gemini-cli", labelKey: "oauth.providers.geminiCli", supportsUrl: true, supportsCookie: false },
  { id: "qwen", labelKey: "oauth.providers.qwen", supportsUrl: true, supportsCookie: false },
  { id: "iflow", labelKey: "oauth.providers.iflow", supportsUrl: true, supportsCookie: true },
];

export type ApiError = {
  code: string;
  message: string;
  retryable?: boolean;
  httpStatus?: number;
};

export type ApiResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: ApiError };

export type OAuthUrlData = {
  provider: OAuthProvider;
  url: string;
  state: string | null;
};

export type OAuthStatusData = {
  status: "ok" | "wait" | "error";
  error?: string;
};

export type OAuthFlow = {
  provider: OAuthProvider;
  phase: OAuthPhase;
  url: string;
  state: string | null;
  startedAt: number | null;
  deadlineAt: number | null;
  lastStatus: OAuthStatusData["status"] | null;
  errorKind: "missing_state" | "request_failed" | "polling_failed" | null;
  errorMessage: string | null;
};

export const DEFAULT_POLLING_POLICY = {
  intervalMs: 2000,
  timeoutMs: 5 * 60 * 1000,
  errorResetMs: 3000,
} as const;
