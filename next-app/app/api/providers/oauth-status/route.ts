import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { fetchManagementJson, toManagementError } from "@/lib/management/client";
import { fail, ok } from "@/lib/management/types";

const schema = z
  .object({
    state: z.string().min(1),
  })
  .strict();

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = schema.safeParse({ state: searchParams.get("state") || "" });
  if (!parsed.success) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Missing state"), { status: 400 });
  }

  try {
    const state = encodeURIComponent(parsed.data.state);
    const { data } = await fetchManagementJson<Record<string, unknown>>(`/get-auth-status?state=${state}`);
    return NextResponse.json(ok(data));
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
