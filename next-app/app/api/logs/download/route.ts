import { NextResponse } from "next/server";

import { fetchLogsRaw } from "@/lib/cliproxy-client";

export async function GET() {
  try {
    const data = await fetchLogsRaw();
    const lines = data?.lines ?? [];
    const body = lines.join("\n");
    const filename = `cli-proxy-logs-${new Date().toISOString().replace(/[:.]/g, "-")}.log`;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename=${filename}`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
