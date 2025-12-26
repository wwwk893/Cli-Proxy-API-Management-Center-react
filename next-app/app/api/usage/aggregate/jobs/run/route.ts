import { NextRequest, NextResponse } from "next/server";
import { Prisma, UsageAggregateJob } from "@prisma/client";
import type { AggregationFilters } from "@/lib/usage/aggregation-filters";

import { prisma } from "@/lib/db";
import { parseJsonBody } from "@/lib/api/validation";
import { usageJobRunSchema } from "@/lib/api";
import { runUsageDailyAggregation } from "@/lib/usage-aggregate";

const WORKER_ID = process.env.USAGE_AGGREGATE_WORKER_ID ?? `api-${process.pid}`;
const DEFAULT_STALE_MINUTES = 60;

const getStaleCutoff = () => {
  const minutes = Number(process.env.USAGE_AGGREGATE_STALE_MINUTES ?? DEFAULT_STALE_MINUTES);
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_STALE_MINUTES;
  return new Date(Date.now() - safeMinutes * 60 * 1000);
};

type JobDelegate = Prisma.UsageAggregateJobDelegate;

async function claimNextJob(workerId: string): Promise<UsageAggregateJob | null> {
  const rows = await prisma.$queryRaw<UsageAggregateJob[]>`
    WITH next_job AS (
      SELECT id FROM "UsageAggregateJob"
      WHERE "status" = 'pending'
      ORDER BY "rangeFrom"
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE "UsageAggregateJob" j
    SET
      "status" = 'running',
      "lockedAt" = NOW(),
      "workerId" = ${workerId},
      "attempts" = j."attempts" + 1
    FROM next_job
    WHERE j.id = next_job.id
    RETURNING j.*;
  `;

  return rows?.[0] ?? null;
}

async function processJob(job: UsageAggregateJob) {
  const start = Date.now();
  const result = await runUsageDailyAggregation({
    kind: "daily",
    rangeFrom: job.rangeFrom,
    rangeTo: job.rangeTo,
    filters: job.filters as AggregationFilters,
  });
  await prisma.usageAggregateJob.update({
    where: { id: job.id },
    data: {
      status: "completed",
      executionMs: Date.now() - start,
      summary: `rows=${result.rowsAffected}`,
      lastError: null,
    },
  });
}

export async function POST(req: NextRequest) {
  const parsed = await parseJsonBody(req, usageJobRunSchema);
  if (!parsed.success) return parsed.error;

  const jobDelegate = (prisma as unknown as { usageAggregateJob?: JobDelegate }).usageAggregateJob;
  if (!jobDelegate) {
    return NextResponse.json({ error: "UsageAggregateJob delegate missing; please regenerate Prisma client" }, { status: 500 });
  }

  const { limit } = parsed.data;

  const staleCutoff = getStaleCutoff();
  await jobDelegate.updateMany({
    where: {
      status: "running",
      OR: [{ lockedAt: null }, { lockedAt: { lt: staleCutoff } }],
    },
    data: {
      status: "pending",
      workerId: null,
      lockedAt: null,
    },
  });

  const errors: { jobId: string; error: string }[] = [];
  let processed = 0;

  while (processed < limit) {
    const job = await claimNextJob(WORKER_ID);
    if (!job) break;
    const started = Date.now();
    try {
      await processJob(job);
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      errors.push({ jobId: job.id, error: message });
      await jobDelegate.update({
        where: { id: job.id },
        data: {
          status: "failed",
          executionMs: Date.now() - started,
          lastError: message,
        },
      });
    }
    processed += 1;
  }

  return NextResponse.json({ processed, errors });
}
