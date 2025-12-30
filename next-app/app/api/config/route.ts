import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { fetchManagementRaw, fetchManagementText, toManagementError } from "@/lib/management/client";
import { fail, ok } from "@/lib/management/types";

const putSchema = z
  .object({
    content: z.string(),
  })
  .strict();

export async function GET() {
  try {
    const { text, headers } = await fetchManagementText("/config.yaml", {
      method: "GET",
      headers: { Accept: "application/yaml" },
    });
    const contentType = headers.get("content-type") || "";
    if (!/yaml/i.test(contentType)) {
      return NextResponse.json(fail("UPSTREAM_ERROR", "Unexpected config content-type"), { status: 502 });
    }
    return NextResponse.json(ok({ content: text }));
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

export async function PUT(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(fail("VALIDATION_ERROR", "Invalid JSON body"), { status: 400 });
  }

  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      fail("VALIDATION_ERROR", "Validation failed", {
        details: parsed.error.flatten(),
      }),
      { status: 400 },
    );
  }

  try {
    const res = await fetchManagementRaw("/config.yaml", {
      method: "PUT",
      headers: {
        "Content-Type": "application/yaml",
        Accept: "application/json, text/plain, */*",
      },
      body: parsed.data.content,
    });

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = (await res.json().catch(() => null)) as any;
      if (data && typeof data === "object" && data.ok === false) {
        return NextResponse.json(fail("VALIDATION_ERROR", data.message || data.error || "Server rejected the update"), {
          status: 400,
        });
      }
    }

    return NextResponse.json(ok({ saved: true }));
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

