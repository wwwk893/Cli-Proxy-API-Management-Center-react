import { NextRequest, NextResponse } from "next/server";

import { assertSameOrigin } from "@/lib/auth/guards";
import { requireSession } from "@/lib/auth/session";
import { fetchManagementJsonWithConfig, toManagementError } from "@/lib/management/client";

type LogsResponse = {
  lines: string[];
  "latest-timestamp"?: string;
  "line-count"?: number;
};

type ClearLogsResponse = {
  status: string;
  removed?: number;
};

const DEFAULT_LOG_FETCH_LIMIT = 2500;

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const after = searchParams.get("after") || undefined;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  try {
    const session = await requireSession();
    const config = { serverBase: session.serverBase, key: session.adminKey };

    const query = new URLSearchParams();
    if (after) {
      query.set("after", after);
    }

    const resolvedLimit = Number.isFinite(limit) ? limit : DEFAULT_LOG_FETCH_LIMIT;
    if (resolvedLimit && Number.isFinite(resolvedLimit)) {
      query.set("limit", String(resolvedLimit));
    }

    const qs = query.toString();
    const path = qs ? `/logs?${qs}` : "/logs";

    const { data } = await fetchManagementJsonWithConfig<LogsResponse>(config, path, { method: "GET" });
    return NextResponse.json(data);
  } catch (err) {
    const managementError = toManagementError(err);
    const status = managementError.httpStatus && managementError.httpStatus >= 400 ? managementError.httpStatus : 500;
    return NextResponse.json({ error: managementError.message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    assertSameOrigin(request);
    const session = await requireSession();
    const config = { serverBase: session.serverBase, key: session.adminKey };

    const { data } = await fetchManagementJsonWithConfig<ClearLogsResponse>(config, "/logs", { method: "DELETE" });
    return NextResponse.json(data);
  } catch (err) {
    const managementError = toManagementError(err);
    const status = managementError.httpStatus && managementError.httpStatus >= 400 ? managementError.httpStatus : 500;
    return NextResponse.json({ error: managementError.message }, { status });
  }
}
