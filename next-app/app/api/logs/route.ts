import { NextRequest, NextResponse } from "next/server";

import { clearLogs, fetchLogs } from "@/lib/cliproxy-client";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const after = searchParams.get("after") || undefined;
  const limitParam = searchParams.get("limit");
  const limit = limitParam ? Number(limitParam) : undefined;

  try {
    const data = await fetchLogs({ after, limit });
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    const data = await clearLogs();
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
