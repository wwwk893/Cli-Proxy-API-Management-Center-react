export type ProviderKeyEntry = {
  index: number;
  maskedKey: string;
  baseUrl?: string;
  proxyUrl?: string;
  hasHeaders?: boolean;
};

export type OpenAIKeyEntry = {
  index: number;
  maskedKey: string;
  proxyUrl?: string;
};

export type OpenAIProviderEntry = {
  index: number;
  name: string;
  baseUrl?: string;
  keys: OpenAIKeyEntry[];
  modelsCount?: number;
  hasHeaders?: boolean;
};

export type ProvidersData = {
  gemini: ProviderKeyEntry[];
  codex: ProviderKeyEntry[];
  claude: ProviderKeyEntry[];
  openaiCompat: OpenAIProviderEntry[];
};

export type KeyProviderKind = "gemini" | "codex" | "claude";

