import { NextRequest, NextResponse } from "next/server";

import { asAuthError } from "@/lib/auth/errors";
import { assertSameOrigin } from "@/lib/auth/guards";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { parseJsonBody } from "@/lib/api/validation";
import { usageAggregateEarliestSchema } from "@/lib/api";
import { buildUsageEventWhere } from "@/lib/usage/aggregation-filters";

const startOfUtcDay = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));

const toUtcDateString = (date: Date) => date.toISOString().slice(0, 10);

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

  const parsed = await parseJsonBody(req, usageAggregateEarliestSchema);
  if (!parsed.success) return parsed.error;

  try {
    const where = buildUsageEventWhere(parsed.data.filters);
    const result = await prisma.usageEvent.aggregate({
      _min: { eventTime: true },
      where,
    });

    const earliest = result._min.eventTime ?? null;
    return NextResponse.json({
      earliestEventTime: earliest ? earliest.toISOString() : null,
      earliestUtcDate: earliest ? toUtcDateString(startOfUtcDay(earliest)) : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
