import { NextResponse } from "next/server";

import { fetchManagementRaw, toManagementError } from "@/lib/management/client";
import { readManagementEnv } from "@/lib/management/env";
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
  const env = readManagementEnv();

  try {
    const res = await fetchManagementRaw("/debug", { method: "GET" });
    const serverVersion = pickHeader(res.headers, "X-CPA-VERSION");
    const serverBuildDate = pickHeader(res.headers, "X-CPA-BUILD-DATE");

    const data: HealthData = {
      connected: true,
      managementUrl: env.managementUrl,
      managementBase: env.managementBase,
      serverVersion: serverVersion || null,
      serverBuildDate: serverBuildDate || null,
    };

    return NextResponse.json(ok(data));
  } catch (err) {
    const managementError = toManagementError(err);
    const status =
      managementError.httpStatus && managementError.httpStatus >= 400
        ? managementError.httpStatus
        : managementError.code === "ENV_MISSING"
          ? 500
          : 502;

    return NextResponse.json(
      fail(managementError.code, managementError.message, {
        retryable: managementError.retryable,
        httpStatus: managementError.httpStatus,
        details: {
          managementUrl: env.managementUrl,
          managementBase: env.managementBase,
          hasKey: env.hasKey,
        },
      }),
      { status },
    );
  }
}
