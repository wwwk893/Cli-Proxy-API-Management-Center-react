import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { parseJsonBody } from "@/lib/api/validation";
import { usageJobBatchRetrySchema } from "@/lib/api";

export async function POST(req: Request) {
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
