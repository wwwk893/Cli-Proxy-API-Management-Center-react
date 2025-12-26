import "dotenv/config";
import os from "node:os";
import process from "node:process";
import { UsageAggregateJob } from "@prisma/client";

import { prisma } from "@/lib/db";
import { runUsageDailyAggregation } from "../lib/usage-aggregate";
import type { AggregationFilters } from "../lib/usage/aggregation-filters";

const WORKER_ID = process.env.USAGE_AGGREGATE_WORKER_ID ?? `${os.hostname()}-${process.pid}`;
const DEFAULT_STALE_MINUTES = 60;

type CliOptions = {
  from?: Date;
  to?: Date;
  enqueueOnly: boolean;
};

function parseDateArg(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = { enqueueOnly: false };
  argv.forEach((arg) => {
    if (arg === "--enqueue-only") {
      opts.enqueueOnly = true;
      return;
    }
    const [key, value] = arg.split("=");
    if (key === "--from") {
      opts.from = parseDateArg(value);
    }
    if (key === "--to") {
      opts.to = parseDateArg(value);
    }
  });
  return opts;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
}

function endOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function getStaleCutoff(): Date {
  const minutes = Number(process.env.USAGE_AGGREGATE_STALE_MINUTES ?? DEFAULT_STALE_MINUTES);
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_STALE_MINUTES;
  return new Date(Date.now() - safeMinutes * 60 * 1000);
}

async function requeueStaleJobs() {
  const cutoff = getStaleCutoff();
  await prisma.usageAggregateJob.updateMany({
    where: {
      status: "running",
      OR: [{ lockedAt: null }, { lockedAt: { lt: cutoff } }],
    },
    data: {
      status: "pending",
      workerId: null,
      lockedAt: null,
    },
  });
}

async function enqueueDailyJobs(rangeFrom: Date, rangeTo: Date) {
  const jobs: { kind: string; rangeFrom: Date; rangeTo: Date; status: string }[] = [];
  let cursor = startOfUtcDay(rangeFrom);
  const end = endOfUtcDay(rangeTo);

  while (cursor.getTime() <= end.getTime()) {
    const dayStart = startOfUtcDay(cursor);
    const dayEnd = endOfUtcDay(cursor);
    jobs.push({ kind: "daily", rangeFrom: dayStart, rangeTo: dayEnd, status: "pending" });
    cursor = addDays(cursor, 1);
  }

  if (jobs.length === 0) return { created: 0 };

  const created = await prisma.usageAggregateJob.createMany({ data: jobs, skipDuplicates: true });
  return { created: created.count };
}

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
  try {
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
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    await prisma.usageAggregateJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        executionMs: Date.now() - start,
        lastError: message,
      },
    });
    throw err;
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const todayStart = startOfUtcDay(new Date());
  const defaultDay = addDays(todayStart, -1);

  const rangeFrom = startOfUtcDay(opts.from ?? defaultDay);
  const rangeTo = endOfUtcDay(opts.to ?? opts.from ?? defaultDay);

  const enqueueResult = await enqueueDailyJobs(rangeFrom, rangeTo);
  console.log(`usage:aggregate enqueued ${enqueueResult.created} job(s)`);

  if (opts.enqueueOnly) {
    console.log("enqueue-only flag set; exiting after enqueue");
    return;
  }

  await requeueStaleJobs();

  while (true) {
    const job = await claimNextJob(WORKER_ID);
    if (!job) {
      console.log("usage:aggregate no pending jobs");
      break;
    }

    console.log(`usage:aggregate processing job ${job.id} [${job.rangeFrom.toISOString()} - ${job.rangeTo.toISOString()}]`);
    await processJob(job);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
