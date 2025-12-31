import { NextRequest, NextResponse } from "next/server";

import { asAuthError } from "@/lib/auth/errors";
import { assertSameOrigin } from "@/lib/auth/guards";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { parseJsonBody } from "@/lib/api/validation";
import { usageJobRetrySchema } from "@/lib/api";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
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

  const { id } = await context.params;
  const parsed = await parseJsonBody(req, usageJobRetrySchema);
  if (!parsed.success) return parsed.error;

  const { force } = parsed.data;

  const job = await prisma.usageAggregateJob.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const allowedStatuses = force ? ["failed", "completed", "running"] : ["failed", "completed"];
  if (!allowedStatuses.includes(job.status)) {
    return NextResponse.json({ error: "Job status does not allow retry" }, { status: 400 });
  }

  const updated = await prisma.usageAggregateJob.update({
    where: { id },
    data: {
      status: "pending",
      lastError: null,
      lockedAt: null,
      workerId: null,
    },
  });

  return NextResponse.json({ job: updated });
}
