import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

type Params = { params: { id: string } };

export async function DELETE(_: Request, { params }: Params) {
  const id = params?.id;
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
