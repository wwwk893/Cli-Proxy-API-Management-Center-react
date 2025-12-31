import { NextRequest, NextResponse } from "next/server";

import { asAuthError } from "@/lib/auth/errors";
import { assertSameOrigin } from "@/lib/auth/guards";
import { requireSession } from "@/lib/auth/session";
import { parseJsonBody } from "@/lib/api/validation";
import { usageCostBackfillSchema } from "@/lib/api";
import { backfillUsageEventCost } from "@/lib/usage-aggregate";

const startOfUtcDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
const endOfUtcDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));

export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req);
    await requireSession();
  } catch (err) {
    const authError = asAuthError(err);
    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: authError.status });
    }
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const body = await parseJsonBody(req, usageCostBackfillSchema);
  if (!body.success) return body.error;

  const now = new Date();
  const rangeFrom = startOfUtcDay(now);
  const rangeTo = endOfUtcDay(now);

  const result = await backfillUsageEventCost({ kind: "daily", rangeFrom, rangeTo });

  return NextResponse.json({
    updatedEvents: result.rowsAffected,
    rangeFrom: rangeFrom.toISOString(),
    rangeTo: rangeTo.toISOString(),
  });
}
