import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/session";
import { fetchManagementRawWithConfig, toManagementError } from "@/lib/management/client";
import { fail, ok } from "@/lib/management/types";

type HealthData = {
  connected: boolean;
  managementUrl: string;
  managementBase: string;
  serverVersion: string | null;
  serverBuildDate: string | null;
};

function pickHeader(headers: Headers, key: string) {
  return headers.get(key) || headers.get(key.toLowerCase());
}

export async function GET() {
  try {
    const session = await requireSession();
    const config = { serverBase: session.serverBase, key: session.adminKey };

    const res = await fetchManagementRawWithConfig(config, "/debug", { method: "GET" });
    const serverVersion = pickHeader(res.headers, "X-CPA-VERSION");
    const serverBuildDate = pickHeader(res.headers, "X-CPA-BUILD-DATE");

    const data: HealthData = {
      connected: true,
      managementUrl: `${session.serverBase}/v0/management`,
      managementBase: session.serverBase,
      serverVersion: serverVersion || null,
      serverBuildDate: serverBuildDate || null,
    };

    return NextResponse.json(ok(data));
  } catch (err) {
    const managementError = toManagementError(err);
    const status = managementError.httpStatus && managementError.httpStatus >= 400 ? managementError.httpStatus : 502;

    return NextResponse.json(
      fail(managementError.code, managementError.message, {
        retryable: managementError.retryable,
        httpStatus: managementError.httpStatus,
      }),
      { status },
    );
  }
}
