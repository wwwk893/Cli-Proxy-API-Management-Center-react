import { NextResponse } from "next/server";

import { asAuthError } from "@/lib/auth/errors";
import { assertSameOrigin } from "@/lib/auth/guards";
import { buildClearSessionCookie, readSessionTokenFromCookies, revokeSessionByToken } from "@/lib/auth/session";
import { fail, ok, type ManagementErrorCode } from "@/lib/management/types";

function mapAuthErrorCode(code: string): ManagementErrorCode {
  if (code === "MISCONFIGURED") return "ENV_MISSING";
  if (code === "FORBIDDEN") return "UNAUTHORIZED";
  if (code === "UNAUTHORIZED") return "UNAUTHORIZED";
  if (code === "VALIDATION_ERROR") return "VALIDATION_ERROR";
  return "UNKNOWN";
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);

    const token = await readSessionTokenFromCookies();
    if (token) {
      await revokeSessionByToken(token);
    }

    const clear = buildClearSessionCookie();
    const res = NextResponse.json(ok({ loggedOut: true }));
    res.cookies.set(clear.name, clear.value, clear.options);
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
