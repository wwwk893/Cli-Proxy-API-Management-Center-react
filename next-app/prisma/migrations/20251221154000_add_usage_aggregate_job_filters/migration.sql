-- Add filters and filtersHash to UsageAggregateJob for multi-filter aggregation jobs
ALTER TABLE "UsageAggregateJob"
  ADD COLUMN "filters" JSONB,
  ADD COLUMN "filtersHash" TEXT NOT NULL DEFAULT 'all';

-- Replace the old unique index with filtersHash-aware uniqueness
DROP INDEX IF EXISTS "UsageAggregateJob_kind_rangeFrom_key";

CREATE UNIQUE INDEX "UsageAggregateJob_kind_rangeFrom_filtersHash_key"
  ON "UsageAggregateJob" ("kind", "rangeFrom", "filtersHash");
