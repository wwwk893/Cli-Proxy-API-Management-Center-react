import { NextResponse } from "next/server";
import { ingestUsageFromProxy } from "@/lib/usage-ingest";
import { parseSearchParams, usageIngestQuerySchema } from "@/lib/api";

export async function POST(req: Request) {
  const { searchParams } = new URL(req.url);
  const proxyBase = process.env.CLIPROXY_MANAGEMENT_BASE;
  const managementKey = process.env.CLIPROXY_MANAGEMENT_KEY;

  if (!proxyBase || !managementKey) {
    return NextResponse.json(
      { ok: false, error: "CLIPROXY_MANAGEMENT_BASE or KEY not set" },
      { status: 400 }
    );
  }

  const parsed = parseSearchParams(searchParams, usageIngestQuerySchema);
  if (!parsed.success) {
    return parsed.error;
  }

  const { since, max, dryRun } = parsed.data;
  const url = new URL(proxyBase);
  const proxyHost = url.host;

  try {
    const result = await ingestUsageFromProxy({
      proxyHost,
      backfillSince: since ? new Date(since) : undefined,
      maxEvents: max,
      dryRun: dryRun ?? false,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("Ingest failed:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
