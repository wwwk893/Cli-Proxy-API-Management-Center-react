import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { fetchManagementJson, toManagementError } from "@/lib/management/client";
import { fail, ok } from "@/lib/management/types";

const schema = z
  .object({
    cookie: z.string().min(1).max(20000),
  })
  .strict();

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function pickSafeIflowCookieResult(raw: unknown): Record<string, unknown> {
  const obj = toRecord(raw);
  const email = typeof obj.email === "string" ? obj.email : undefined;
  const type = typeof obj.type === "string" ? obj.type : undefined;
  const expired = obj.expired;

  const savedPath =
    typeof obj.saved_path === "string"
      ? obj.saved_path
      : typeof obj.savedPath === "string"
        ? obj.savedPath
        : typeof obj.path === "string"
          ? obj.path
          : undefined;

  return {
    email,
    expired,
    path: savedPath,
    type,
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Missing cookie"), { status: 400 });
  }

  const cookie = parsed.data.cookie.trim();
  if (!cookie) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Missing cookie"), { status: 400 });
  }

  try {
    const { data } = await fetchManagementJson<Record<string, unknown>>("/iflow-auth-url", {
      method: "POST",
      body: JSON.stringify({ cookie }),
    });

    return NextResponse.json(ok(pickSafeIflowCookieResult(data)));
  } catch (err) {
    const managementError = toManagementError(err);
    const status = managementError.httpStatus && managementError.httpStatus >= 400 ? managementError.httpStatus : 500;
    return NextResponse.json(
      fail(managementError.code, managementError.message, {
        retryable: managementError.retryable,
        httpStatus: managementError.httpStatus,
      }),
      { status },
    );
  }
}
