import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { AGGREGATION_CHANNELS } from "@/lib/usage/aggregation-constants";

const startOfUtcDay = (date: Date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));

const toUtcDateString = (date: Date) => date.toISOString().slice(0, 10);

export async function GET() {
  try {
    const [minEvent, models] = await Promise.all([
      prisma.usageEvent.aggregate({ _min: { eventTime: true } }),
      prisma.usageEvent.findMany({
        distinct: ["model"],
        select: { model: true },
        orderBy: { model: "asc" },
      }),
    ]);

    const earliest = minEvent._min.eventTime;
    const earliestEventTime = earliest ? earliest.toISOString() : null;
    const earliestUtcDate = earliest ? toUtcDateString(startOfUtcDay(earliest)) : null;
    const todayStart = startOfUtcDay(new Date());
    const yesterdayUtcDate = toUtcDateString(new Date(todayStart.getTime() - 1));

    return NextResponse.json({
      channels: AGGREGATION_CHANNELS,
      models: models.map((m) => m.model).filter(Boolean),
      earliestEventTime,
      earliestUtcDate,
      yesterdayUtcDate,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
