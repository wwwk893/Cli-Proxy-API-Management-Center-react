import "server-only";

const DEFAULT_MANAGEMENT_URL = "http://localhost:3818/v0/management";

function ensureHttpScheme(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `http://${trimmed}`;
}

function ensureManagementUrl(input: string) {
  let url = ensureHttpScheme(input);
  url = url.replace(/\/+$/g, "");

  if (/\/v0\/management$/i.test(url)) {
    return url;
  }

  return `${url}/v0/management`;
}

export type ManagementEnv = {
  managementUrl: string;
  managementBase: string;
  managementKey: string | null;
  hasKey: boolean;
};

export function readManagementEnv(): ManagementEnv {
  const rawBase = process.env.CLIPROXY_MANAGEMENT_BASE || DEFAULT_MANAGEMENT_URL;
  const managementUrl = ensureManagementUrl(rawBase);
  const managementBase = managementUrl.replace(/\/v0\/management$/i, "");
  const managementKey = process.env.CLIPROXY_MANAGEMENT_KEY?.trim() || null;

  return {
    managementUrl,
    managementBase,
    managementKey,
    hasKey: Boolean(managementKey),
  };
}
