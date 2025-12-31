import "server-only";

import { serverEnv } from "@/lib/env";
import { AuthError } from "./errors";

export function getCanonicalSiteUrl(): URL {
  return new URL(serverEnv.NEXT_PUBLIC_SITE_URL);
}

export function getCanonicalOrigin(): string {
  return getCanonicalSiteUrl().origin;
}

export function getCanonicalHostname(): string {
  return getCanonicalSiteUrl().hostname;
}

export function getAuthCookieName(): string {
  return serverEnv.AUTH_COOKIE_NAME;
}

export function getAuthDefaultTtlDays(): number {
  return serverEnv.AUTH_SESSION_TTL_DAYS;
}

export function getCookieSecureFlag(): boolean {
  // Public deployment should be HTTPS; allow local dev over http.
  return getCanonicalSiteUrl().protocol === "https:";
}

export function requireEncryptionKeyBytes(): Buffer {
  const raw = serverEnv.AUTH_ENCRYPTION_KEY;
  if (!raw) {
    throw new AuthError("MISCONFIGURED", "服务端未配置 AUTH_ENCRYPTION_KEY", 500);
  }

  let buf: Buffer;
  try {
    buf = Buffer.from(raw, "base64");
  } catch {
    throw new AuthError("MISCONFIGURED", "AUTH_ENCRYPTION_KEY 必须为 base64 编码", 500);
  }

  if (buf.length !== 32) {
    throw new AuthError("MISCONFIGURED", "AUTH_ENCRYPTION_KEY 必须为 32 bytes（base64）", 500);
  }

  return buf;
}
