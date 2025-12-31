import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/session";
import { fetchManagementRawWithConfig, toManagementError } from "@/lib/management/client";
import { fail } from "@/lib/management/types";

export async function GET() {
  try {
    const session = await requireSession();
    const config = { serverBase: session.serverBase, key: session.adminKey };

    const res = await fetchManagementRawWithConfig(config, "/config.yaml", {
      method: "GET",
      headers: { Accept: "application/yaml" },
    });
    const buffer = await res.arrayBuffer();

    const headers = new Headers();
    headers.set("Content-Type", res.headers.get("content-type") || "application/yaml");
    headers.set("Content-Disposition", 'attachment; filename="config.yaml"');
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

