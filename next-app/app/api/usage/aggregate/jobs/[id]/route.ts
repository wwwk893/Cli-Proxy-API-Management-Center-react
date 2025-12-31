import { NextRequest, NextResponse } from "next/server";

import { Prisma } from "@prisma/client";

import { asAuthError } from "@/lib/auth/errors";
import { assertSameOrigin } from "@/lib/auth/guards";
import { requireSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(req: NextRequest, { params }: RouteContext) {
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

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing job id" }, { status: 400 });
  }

  const jobDelegate = (prisma as unknown as { usageAggregateJob?: Prisma.UsageAggregateJobDelegate }).usageAggregateJob;
  if (!jobDelegate) {
    return NextResponse.json({ error: "UsageAggregateJob delegate missing; please regenerate Prisma client" }, { status: 500 });
  }

  const job = await jobDelegate.findUnique({ where: { id } });
  if (!job) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }
  if (job.status === "running") {
    return NextResponse.json({ error: "Cannot delete running job" }, { status: 400 });
  }

  await jobDelegate.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
