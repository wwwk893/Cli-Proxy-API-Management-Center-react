import { NextResponse } from "next/server";

import { requireSession } from "@/lib/auth/session";
import { fetchManagementJsonWithConfig, toManagementError } from "@/lib/management/client";

type LogsResponse = {
  lines?: string[];
};

export async function GET() {
  try {
    const session = await requireSession();
    const config = { serverBase: session.serverBase, key: session.adminKey };

    const { data } = await fetchManagementJsonWithConfig<LogsResponse>(config, "/logs", { method: "GET" });
    const lines = Array.isArray(data?.lines) ? data.lines : [];
    const body = lines.join("\n");
    const filename = `cli-proxy-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.log`;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename=${filename}`,
      },
    });
  } catch (err) {
    const managementError = toManagementError(err);
    const status = managementError.httpStatus && managementError.httpStatus >= 400 ? managementError.httpStatus : 500;
    return NextResponse.json({ error: managementError.message }, { status });
  }
}
