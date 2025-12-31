import { NextResponse } from "next/server";

import { asAuthError } from "@/lib/auth/errors";
import { assertSameOrigin } from "@/lib/auth/guards";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { parseJsonBody } from "@/lib/api/validation";
import { usageJobBatchRetrySchema } from "@/lib/api";

export async function POST(req: Request) {
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

  const parsed = await parseJsonBody(req, usageJobBatchRetrySchema);
  if (!parsed.success) return parsed.error;

  const { jobIds, force } = parsed.data;

  const allowed = force ? ["failed", "completed", "running"] : ["failed", "completed"];

  const result = await prisma.usageAggregateJob.updateMany({
    where: {
      id: { in: jobIds },
      status: { in: allowed },
    },
    data: {
      status: "pending",
      lastError: null,
      lockedAt: null,
      workerId: null,
    },
  });

  return NextResponse.json({ count: result.count, message: `Queued ${result.count} jobs for retry` });
}
