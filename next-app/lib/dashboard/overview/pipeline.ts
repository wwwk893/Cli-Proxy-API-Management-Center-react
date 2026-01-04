import "server-only";

import type { PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";

import type { DashboardPipelineHealth } from "./types";

export async function queryPipelineHealth(prisma: PrismaClient): Promise<DashboardPipelineHealth> {
  const jobDelegate = (prisma as unknown as { usageAggregateJob?: Prisma.UsageAggregateJobDelegate }).usageAggregateJob;
  if (!jobDelegate) {
    throw new Error("UsageAggregateJob delegate missing; please regenerate Prisma client");
  }

  const [pending, running, failed, recentFailedJobs] = await Promise.all([
    jobDelegate.count({ where: { status: "pending" } }),
    jobDelegate.count({ where: { status: "running" } }),
    jobDelegate.count({ where: { status: "failed" } }),
    jobDelegate.findMany({
      where: { status: "failed" },
      orderBy: [
        { rangeFrom: "desc" },
        { id: "asc" },
      ],
      take: 3,
      select: {
        id: true,
        kind: true,
        rangeFrom: true,
        rangeTo: true,
        lastError: true,
      },
    }),
  ]);

  return {
    pending,
    running,
    failed,
    recentFailedJobs: recentFailedJobs.map((job: any) => ({
      id: String(job.id),
      kind: String(job.kind),
      rangeFrom: new Date(job.rangeFrom).toISOString(),
      rangeTo: new Date(job.rangeTo).toISOString(),
      lastError: job.lastError ? String(job.lastError) : null,
    })),
  };
}
