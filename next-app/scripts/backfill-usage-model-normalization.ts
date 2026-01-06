import "dotenv/config";

import process from "node:process";

import { prisma } from "@/lib/db";
import { normalizeModel } from "@/lib/usage/model-normalize";
import { runUsageDailyAggregation } from "../lib/usage-aggregate";

type CliOptions = {
  from?: Date;
  to?: Date;
  batchSize: number;
  maxEvents?: number;
  dryRun: boolean;
  rebuildDaily: boolean;
  rebuildDailyOnly: boolean;
};

function parseDateArg(value?: string): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseNumberArg(value: string | undefined, fallback: number): number {
  const n = value ? Number(value) : Number.NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseArgs(argv: string[]): CliOptions {
  const opts: CliOptions = {
    batchSize: 500,
    dryRun: false,
    rebuildDaily: false,
    rebuildDailyOnly: false,
  };

  argv.forEach((arg) => {
    if (arg === "--dry-run") {
      opts.dryRun = true;
      return;
    }
    if (arg === "--rebuild-daily") {
      opts.rebuildDaily = true;
      return;
    }
    if (arg === "--rebuild-daily-only") {
      opts.rebuildDaily = true;
      opts.rebuildDailyOnly = true;
      return;
    }
    const [key, value] = arg.split("=");
    if (key === "--from") opts.from = parseDateArg(value);
    if (key === "--to") opts.to = parseDateArg(value);
    if (key === "--batch-size") opts.batchSize = parseNumberArg(value, 500);
    if (key === "--max-events") {
      const parsed = parseNumberArg(value, 0);
      if (parsed > 0) opts.maxEvents = parsed;
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

async function backfillEvents(opts: CliOptions) {
  const from = opts.from ? startOfUtcDay(opts.from) : undefined;
  const to = opts.to ? endOfUtcDay(opts.to) : undefined;

  const effortAllowed = ["low", "medium", "high", "xhigh"];

  let totalProcessed = 0;
  let totalUpdated = 0;

  while (true) {
    if (opts.maxEvents && totalProcessed >= opts.maxEvents) break;

    const remaining = opts.maxEvents ? Math.max(0, opts.maxEvents - totalProcessed) : undefined;
    const limit = Math.min(opts.batchSize, remaining ?? opts.batchSize);

    const rows = await prisma.$queryRaw<
      Array<{ id: string; model: string; modelRaw: string | null; effort: string | null }>
    >`
      SELECT "id", "model", "modelRaw", "effort"
      FROM "UsageEvent"
      WHERE
        (${from ?? null}::timestamptz IS NULL OR "eventTime" >= ${from ?? null}::timestamptz)
        AND (${to ?? null}::timestamptz IS NULL OR "eventTime" <= ${to ?? null}::timestamptz)
        AND (
          "modelRaw" IS NULL
          OR "modelCanonical" IS NULL
          OR ("effort" IS NOT NULL AND (LOWER(BTRIM("effort")) <> "effort" OR NOT (LOWER(BTRIM("effort")) = ANY(${effortAllowed}::text[]))))
          OR ("effort" IS NULL AND ("model" ~* '-(low|medium|high|xhigh)$' OR "model" ~* '\\\\((low|medium|high|xhigh)\\\\)$'))
        )
      ORDER BY "eventTime" ASC
      LIMIT ${limit};
    `;

    if (!rows.length) break;

    totalProcessed += rows.length;

    const updates = rows.map((row) => {
      const modelRaw = row.modelRaw ?? row.model;
      const normalized = normalizeModel({ model: modelRaw, effort: row.effort });
      return prisma.usageEvent.update({
        where: { id: row.id },
        data: {
          modelRaw: normalized.modelRaw,
          modelCanonical: normalized.modelCanonical,
          effort: normalized.effort,
        },
      });
    });

    if (!opts.dryRun) {
      const results = await prisma.$transaction(updates);
      totalUpdated += results.length;
    }

    console.log(
      JSON.stringify(
        {
          stage: "backfill-events",
          batch: rows.length,
          totalProcessed,
          totalUpdated: opts.dryRun ? 0 : totalUpdated,
          from: from?.toISOString() ?? null,
          to: to?.toISOString() ?? null,
          dryRun: opts.dryRun,
        },
        null,
        2,
      ),
    );
  }

  return { processed: totalProcessed, updated: opts.dryRun ? 0 : totalUpdated };
}

async function rebuildUsageDaily(opts: CliOptions) {
  if (!opts.from || !opts.to) {
    console.warn("rebuild-daily requires --from and --to; skipping UsageDaily rebuild");
    return { days: 0, deletedRows: 0, aggregatedRows: 0 };
  }

  let cursor = startOfUtcDay(opts.from);
  const end = endOfUtcDay(opts.to);

  let days = 0;
  let deletedRows = 0;
  let aggregatedRows = 0;

  while (cursor.getTime() <= end.getTime()) {
    const dayStart = startOfUtcDay(cursor);
    const dayEnd = endOfUtcDay(cursor);
    days += 1;

    if (!opts.dryRun) {
      const del = await prisma.usageDaily.deleteMany({
        where: {
          date: {
            gte: dayStart,
            lte: dayEnd,
          },
        },
      });
      deletedRows += del.count;
    }

    const result = await runUsageDailyAggregation({ kind: "daily", rangeFrom: dayStart, rangeTo: dayEnd });
    aggregatedRows += result.rowsAffected;

    console.log(
      JSON.stringify(
        {
          stage: "rebuild-daily",
          day: dayStart.toISOString().slice(0, 10),
          deletedRows: opts.dryRun ? 0 : deletedRows,
          aggregatedRows,
          dryRun: opts.dryRun,
        },
        null,
        2,
      ),
    );

    cursor = addDays(cursor, 1);
  }

  return { days, deletedRows: opts.dryRun ? 0 : deletedRows, aggregatedRows };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  console.log(
    JSON.stringify(
      {
        stage: "start",
        opts: {
          ...opts,
          from: opts.from?.toISOString() ?? null,
          to: opts.to?.toISOString() ?? null,
        },
      },
      null,
      2,
    ),
  );

  const eventsResult = opts.rebuildDailyOnly ? { processed: 0, updated: 0 } : await backfillEvents(opts);
  const dailyResult = opts.rebuildDaily ? await rebuildUsageDaily(opts) : { days: 0, deletedRows: 0, aggregatedRows: 0 };

  console.log(
    JSON.stringify(
      {
        stage: "done",
        events: eventsResult,
        daily: dailyResult,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
