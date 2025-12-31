import { NextResponse } from "next/server";
import { z } from "zod";

import { asAuthError } from "@/lib/auth/errors";
import { assertSameOrigin } from "@/lib/auth/guards";
import { buildServerBase, buildSessionCookie, createSession } from "@/lib/auth/session";
import { fail, ok, type ManagementErrorCode } from "@/lib/management/types";

type LoginData = {
  authenticated: true;
  serverBase: string;
  expiresAt: string;
};

function mapAuthErrorCode(code: string): ManagementErrorCode {
  if (code === "MISCONFIGURED") return "ENV_MISSING";
  if (code === "FORBIDDEN") return "UNAUTHORIZED";
  if (code === "UNAUTHORIZED") return "UNAUTHORIZED";
  if (code === "VALIDATION_ERROR") return "VALIDATION_ERROR";
  return "UNKNOWN";
}

function pickHeader(headers: Headers, key: string) {
  return headers.get(key) || headers.get(key.toLowerCase());
}

const bodySchema = z
  .object({
    port: z.coerce.number().int().min(1).max(65535),
    adminKey: z.string().trim().min(1),
    rememberDays: z.coerce.number().int().min(1).max(365).optional(),
  })
  .strict();

async function probeManagement(params: { serverBase: string; adminKey: string }) {
  const managementUrl = `${params.serverBase}/v0/management`;

  let res: Response;
  try {
    res = await fetch(`${managementUrl}/debug`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${params.adminKey}`,
      },
      cache: "no-store",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false as const, error: fail("UPSTREAM_ERROR", `无法连接 management API：${message}`), status: 502 };
  }

  if (!res.ok) {
    const status = res.status || 502;
    if (status === 401 || status === 403) {
      return {
        ok: false as const,
        error: fail("UNAUTHORIZED", "认证失败：密钥无效或无权限", { httpStatus: status }),
        status,
      };
    }
    if (status === 404) {
      return {
        ok: false as const,
        error: fail("NOT_FOUND", "未找到 management API（请检查端口）", { httpStatus: status }),
        status,
      };
    }
    if (status === 429) {
      return {
        ok: false as const,
        error: fail("RATE_LIMITED", "触发限流，请稍后重试", { httpStatus: status, retryable: true }),
        status,
      };
    }

    return {
      ok: false as const,
      error: fail("UPSTREAM_ERROR", `Management API error: ${status} ${res.statusText}`, {
        httpStatus: status,
        retryable: status >= 500,
      }),
      status: status >= 400 && status < 600 ? status : 502,
    };
  }

  const serverVersion = pickHeader(res.headers, "X-CPA-VERSION");
  const serverBuildDate = pickHeader(res.headers, "X-CPA-BUILD-DATE");
  if (!serverVersion) {
    return {
      ok: false as const,
      error: fail("VALIDATION_ERROR", "目标不是管理服务（缺少 X-CPA-VERSION）", {
        details: { serverBase: params.serverBase },
      }),
      status: 400,
    };
  }

  return {
    ok: true as const,
    data: {
      serverVersion: serverVersion || null,
      serverBuildDate: serverBuildDate || null,
      managementUrl,
    },
  };
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(fail("VALIDATION_ERROR", "Invalid JSON body"), { status: 400 });
    }

    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        fail("VALIDATION_ERROR", "Validation failed", { details: parsed.error.flatten() }),
        { status: 400 },
      );
    }

    const { port, adminKey, rememberDays } = parsed.data;
    const serverBase = buildServerBase(port);

    const probe = await probeManagement({ serverBase, adminKey });
    if (!probe.ok) {
      return NextResponse.json(probe.error, { status: probe.status });
    }

    const { token, expiresAt } = await createSession({ serverBase, adminKey, rememberDays });

    const cookie = buildSessionCookie(token, rememberDays);

    const data: LoginData = {
      authenticated: true,
      serverBase,
      expiresAt: expiresAt.toISOString(),
    };

    const res = NextResponse.json(ok(data));
    res.cookies.set(cookie.name, cookie.value, cookie.options);
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
