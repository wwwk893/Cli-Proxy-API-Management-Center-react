import "server-only";

import { AuthError } from "./errors";
import { getCanonicalOrigin } from "./config";

export function sanitizeNextPath(value: string | null): string | null {
  if (!value) return null;
  const next = value.trim();
  if (!next.startsWith("/")) return null;
  if (next.startsWith("//")) return null;
  return next;
}

export function parsePort(input: unknown): number {
  const num = typeof input === "number" ? input : Number(input);
  if (!Number.isInteger(num) || num < 1 || num > 65535) {
    throw new AuthError("VALIDATION_ERROR", "端口必须是 1-65535 的整数", 400);
  }
  return num;
}

export function assertSameOrigin(req: Request) {
  const canonical = getCanonicalOrigin();
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  if (origin) {
    if (origin !== canonical) {
      throw new AuthError("FORBIDDEN", "CSRF 检测失败（Origin 不匹配）", 403, { origin, canonical });
    }
    return;
  }

  if (referer) {
    if (!referer.startsWith(canonical)) {
      throw new AuthError("FORBIDDEN", "CSRF 检测失败（Referer 不匹配）", 403, { referer, canonical });
    }
    return;
  }

  throw new AuthError("FORBIDDEN", "CSRF 检测失败（缺少 Origin/Referer）", 403);
}
