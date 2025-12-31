import { Suspense } from "react";

import JobsView from "./aggregation/jobs-view";
import { JobsResponse } from "./aggregation/types";

async function fetchInitialJobs(): Promise<JobsResponse> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const res = await fetch(`${base}/api/usage/aggregate/jobs?limit=20&page=1`, {
    cache: "no-store",
  });
  if (!res.ok) {
    return { data: [], page: 1, limit: 20, total: 0 };
  }
  return res.json();
}

export default async function PipelinePage() {
  const initialData = await fetchInitialJobs();
  return (
    <div className="p-6 space-y-6">
      <Suspense fallback={<div className="text-sm text-muted-foreground">Loading jobs...</div>}>
        <JobsView initialData={initialData} />
      </Suspense>
    </div>
  );
}
