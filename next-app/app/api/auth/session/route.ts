import { NextResponse } from "next/server";

import { asAuthError } from "@/lib/auth/errors";
import { buildSessionCookie, getSessionInfoByToken, readSessionTokenFromCookies } from "@/lib/auth/session";
import { fail, ok, type ManagementErrorCode } from "@/lib/management/types";

function mapAuthErrorCode(code: string): ManagementErrorCode {
  if (code === "MISCONFIGURED") return "ENV_MISSING";
  if (code === "FORBIDDEN") return "UNAUTHORIZED";
  if (code === "UNAUTHORIZED") return "UNAUTHORIZED";
  if (code === "VALIDATION_ERROR") return "VALIDATION_ERROR";
  return "UNKNOWN";
}

type SessionData =
  | { authenticated: false }
  | { authenticated: true; serverBase: string; expiresAt: string };

export async function GET() {
  try {
    const token = await readSessionTokenFromCookies();
    if (!token) {
      const data: SessionData = { authenticated: false };
      return NextResponse.json(ok(data));
    }

    const info = await getSessionInfoByToken(token);
    if (!info) {
      const data: SessionData = { authenticated: false };
      return NextResponse.json(ok(data));
    }

    const data: SessionData = {
      authenticated: true,
      serverBase: info.serverBase,
      expiresAt: info.expiresAt.toISOString(),
    };

    const cookie = buildSessionCookie(token);
    const maxAge = Math.max(1, Math.floor((info.expiresAt.getTime() - Date.now()) / 1000));
    const res = NextResponse.json(ok(data));
    res.cookies.set(cookie.name, cookie.value, { ...cookie.options, maxAge });
    return res;
  } catch (err) {
    const authError = asAuthError(err);
    if (authError) {
      const status = authError.status || 500;
      const mapped = mapAuthErrorCode(authError.code);
      return NextResponse.json(fail(mapped, authError.message, { details: authError.details }), { status });
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(fail("UNKNOWN", message), { status: 500 });
  }
}
