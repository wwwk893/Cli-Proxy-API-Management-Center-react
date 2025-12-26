-- Add status column for failure/success aggregation
ALTER TABLE "UsageEvent"
ADD COLUMN IF NOT EXISTS "status" TEXT;

-- Optional: index for status filters/aggregations
CREATE INDEX IF NOT EXISTS "UsageEvent_status_idx" ON "UsageEvent"("status");
