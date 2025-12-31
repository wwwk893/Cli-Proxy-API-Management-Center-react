import { NextResponse } from "next/server";
import { z } from "zod";

import { assertSameOrigin } from "@/lib/auth/guards";
import { buildServerBase } from "@/lib/auth/session";
import { asAuthError } from "@/lib/auth/errors";
import { fail, ok, type ManagementErrorCode } from "@/lib/management/types";

function mapAuthErrorCode(code: string): ManagementErrorCode {
  if (code === "MISCONFIGURED") return "ENV_MISSING";
  if (code === "FORBIDDEN") return "UNAUTHORIZED";
  if (code === "UNAUTHORIZED") return "UNAUTHORIZED";
  if (code === "VALIDATION_ERROR") return "VALIDATION_ERROR";
  return "UNKNOWN";
}

type ProbeData = {
  connected: boolean;
  serverBase: string;
  managementUrl: string;
  serverVersion: string | null;
  serverBuildDate: string | null;
};

function pickHeader(headers: Headers, key: string) {
  return headers.get(key) || headers.get(key.toLowerCase());
}

const bodySchema = z
  .object({
    port: z.coerce.number().int().min(1).max(65535),
    adminKey: z.string().trim().min(1),
  })
  .strict();

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

    const { port, adminKey } = parsed.data;
    const serverBase = buildServerBase(port);
    const managementUrl = `${serverBase}/v0/management`;

    let res: Response;
    try {
      res = await fetch(`${managementUrl}/debug`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${adminKey}`,
        },
        cache: "no-store",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return NextResponse.json(
        fail("UPSTREAM_ERROR", `无法连接 management API：${message}`),
        { status: 502 },
      );
    }

    if (!res.ok) {
      const status = res.status || 502;
      if (status === 401 || status === 403) {
        return NextResponse.json(
          fail("UNAUTHORIZED", "认证失败：密钥无效或无权限", { httpStatus: status }),
          { status },
        );
      }
      if (status === 404) {
        return NextResponse.json(
          fail("NOT_FOUND", "未找到 management API（请检查端口）", { httpStatus: status }),
          { status },
        );
      }
      if (status === 429) {
        return NextResponse.json(
          fail("RATE_LIMITED", "触发限流，请稍后重试", { httpStatus: status, retryable: true }),
          { status },
        );
      }

      return NextResponse.json(
        fail("UPSTREAM_ERROR", `Management API error: ${status} ${res.statusText}`, {
          httpStatus: status,
          retryable: status >= 500,
        }),
        { status: status >= 400 && status < 600 ? status : 502 },
      );
    }

    const serverVersion = pickHeader(res.headers, "X-CPA-VERSION");
    const serverBuildDate = pickHeader(res.headers, "X-CPA-BUILD-DATE");

    if (!serverVersion) {
      return NextResponse.json(
        fail("VALIDATION_ERROR", "目标不是管理服务（缺少 X-CPA-VERSION）", {
          details: { serverBase },
        }),
        { status: 400 },
      );
    }

    const data: ProbeData = {
      connected: true,
      serverBase,
      managementUrl,
      serverVersion: serverVersion || null,
      serverBuildDate: serverBuildDate || null,
    };

    return NextResponse.json(ok(data));
  } catch (err) {
    const authError = asAuthError(err);
    if (authError) {
      const status = authError.status || 500;
      const code = mapAuthErrorCode(authError.code);
      return NextResponse.json(
        fail(code, authError.message, {
          details: authError.details,
        }),
        { status },
      );
    }

    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(fail("UNKNOWN", message), { status: 500 });
  }
}
