import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/session";
import { fetchManagementRawWithConfig, toManagementError } from "@/lib/management/client";
import { fail } from "@/lib/management/types";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const name = (searchParams.get("name") || "").trim();
  if (!name) {
    return NextResponse.json(fail("VALIDATION_ERROR", "Missing name"), { status: 400 });
  }

  try {
    const session = await requireSession();
    const config = { serverBase: session.serverBase, key: session.adminKey };

    const res = await fetchManagementRawWithConfig(
      config,
      `/auth-files/download?name=${encodeURIComponent(name)}`,
      { method: "GET" },
    );
    const buffer = await res.arrayBuffer();

    const headers = new Headers();
    const contentType = res.headers.get("content-type") || "application/octet-stream";
    headers.set("Content-Type", contentType);

    const contentDisposition = res.headers.get("content-disposition");
    if (contentDisposition) headers.set("Content-Disposition", contentDisposition);
    else headers.set("Content-Disposition", `attachment; filename="${name}"`);

    return new NextResponse(buffer, { status: 200, headers });
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

