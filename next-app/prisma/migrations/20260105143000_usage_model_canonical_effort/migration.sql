-- Add model normalization columns (B-完整)
ALTER TABLE "UsageEvent"
  ADD COLUMN "modelRaw" TEXT,
  ADD COLUMN "modelCanonical" TEXT;

ALTER TABLE "UsageDaily"
  ADD COLUMN "modelCanonical" TEXT,
  ADD COLUMN "effort" TEXT;

-- Update composite unique index to include effort dimension (nullable; NULLs are treated as distinct)
DROP INDEX IF EXISTS "daily_composite_key";
CREATE UNIQUE INDEX "daily_composite_key"
ON "UsageDaily"("date", "apiPath", "model", "effort", "proxyHost", "authSource", "authIndex", "authFailed");

-- Update NULLs-as-equal unique index used by UsageDaily upsert idempotency
DROP INDEX IF EXISTS "UsageDaily_composite_key_nnd";
CREATE UNIQUE INDEX "UsageDaily_composite_key_nnd"
ON "UsageDaily" (
  "date",
  "apiPath",
  "model",
  COALESCE("effort", ''),
  COALESCE("proxyHost", ''),
  COALESCE("authSource", ''),
  COALESCE("authIndex", -1),
  COALESCE("authFailed", false)
);

-- Helpful lookup indexes for canonical grouping
CREATE INDEX "UsageDaily_date_modelCanonical_effort_idx"
ON "UsageDaily" ("date", "modelCanonical", "effort");

CREATE INDEX "UsageDaily_date_modelCanonical_idx"
ON "UsageDaily" ("date", "modelCanonical");

CREATE INDEX "UsageDaily_date_model_idx"
ON "UsageDaily" ("date", "model");

CREATE INDEX "UsageEvent_eventTime_modelCanonical_idx"
ON "UsageEvent" ("eventTime", "modelCanonical");

CREATE INDEX "UsageEvent_eventTime_modelCanonical_effort_idx"
ON "UsageEvent" ("eventTime", "modelCanonical", "effort");
