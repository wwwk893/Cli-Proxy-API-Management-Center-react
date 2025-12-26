import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import { parseJsonBody, parseSearchParams } from "@/lib/api/validation";
import { usageJobCreateSchema, usageJobListQuerySchema } from "@/lib/api";
import { buildFiltersHash } from "@/lib/usage/aggregation-filters";

const MAX_RANGE_DAYS = 90;

const startOfUtcDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));
const endOfUtcDay = (date: Date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));

function getDaysBetween(from: Date, to: Date) {
  const days: { rangeFrom: Date; rangeTo: Date }[] = [];
  let cursor = startOfUtcDay(from);
  const end = endOfUtcDay(to);

  while (cursor.getTime() <= end.getTime()) {
    const dayStart = startOfUtcDay(cursor);
    const dayEnd = endOfUtcDay(cursor);
    days.push({ rangeFrom: dayStart, rangeTo: dayEnd });
    cursor = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
  }

  return days;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const parsed = parseSearchParams(searchParams, usageJobListQuerySchema);
  if (!parsed.success) return parsed.error;

  const { page, limit, status = [], kind, from, to } = parsed.data;

  const jobDelegate = (prisma as unknown as { usageAggregateJob?: Prisma.UsageAggregateJobDelegate }).usageAggregateJob;
  if (!jobDelegate) {
    // Defensive fallback: if the client is out-of-date and delegate is missing, return empty
    return NextResponse.json({ data: [], page, limit, total: 0 });
  }

  const where: Prisma.UsageAggregateJobWhereInput = {};
  if (status.length > 0) {
    where.status = { in: status };
  }
  if (kind) {
    where.kind = kind;
  }
  if (from) {
    where.rangeFrom = { ...(where.rangeFrom as Prisma.DateTimeFilter | undefined), gte: new Date(from) };
  }
  if (to) {
    where.rangeFrom = { ...(where.rangeFrom as Prisma.DateTimeFilter | undefined), lte: new Date(to) };
  }

  const skip = (page - 1) * limit;

  const [total, data] = await Promise.all([
    jobDelegate.count({ where }),
    jobDelegate.findMany({
      where,
      orderBy: [
        { rangeFrom: "desc" },
        { id: "asc" },
      ],
      skip,
      take: limit,
    }),
  ]);

  return NextResponse.json({ data, page, limit, total });
}

export async function POST(req: NextRequest) {
  const body = await parseJsonBody(req, usageJobCreateSchema);
  if (!body.success) return body.error;

  const jobDelegate = (prisma as unknown as { usageAggregateJob?: Prisma.UsageAggregateJobDelegate }).usageAggregateJob;
  if (!jobDelegate) {
    return NextResponse.json({ error: "UsageAggregateJob delegate missing; please regenerate Prisma client" }, { status: 500 });
  }

  const { kind = "daily", from, to, force = false, filters } = body.data;
  let allModels: string[] | undefined;
  if (filters?.models?.length) {
    const models = await prisma.usageEvent.findMany({
      distinct: ["model"],
      select: { model: true },
      orderBy: { model: "asc" },
    });
    allModels = models.map((item) => item.model).filter((model): model is string => Boolean(model));
  }
  const { hash: filtersHash, normalized: normalizedFilters } = buildFiltersHash(filters, { allModels });

  const now = new Date();
  const todayStart = startOfUtcDay(now);
  const yesterdayEnd = new Date(todayStart.getTime() - 1);
  const defaultDay = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

  const fromDate = from ? new Date(from) : defaultDay;
  const toDate = to ? new Date(to) : fromDate;

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  if (fromDate > toDate) {
    return NextResponse.json({ error: "from must be before or equal to to" }, { status: 400 });
  }

  if (fromDate > yesterdayEnd || toDate > yesterdayEnd) {
    return NextResponse.json({ error: "Cannot schedule aggregation for today or future dates" }, { status: 400 });
  }

  const days = getDaysBetween(fromDate, toDate);
  if (days.length > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: `Date range too large (max ${MAX_RANGE_DAYS} days)` }, { status: 400 });
  }

  const createPayload = days.map((d) => ({
    kind,
    rangeFrom: d.rangeFrom,
    rangeTo: d.rangeTo,
    status: "pending" as const,
    attempts: 0,
    filters: normalizedFilters ?? undefined,
    filtersHash,
  }));

  if (force) {
    await jobDelegate.updateMany({
      where: {
        kind,
        rangeFrom: { in: days.map((d) => d.rangeFrom) },
        filtersHash,
      },
      data: {
        status: "pending",
        lastError: null,
        lockedAt: null,
        workerId: null,
        summary: null,
        executionMs: null,
      },
    });
  }

  const result = await jobDelegate.createMany({ data: createPayload, skipDuplicates: true });

  return NextResponse.json({ created: result.count });
}
