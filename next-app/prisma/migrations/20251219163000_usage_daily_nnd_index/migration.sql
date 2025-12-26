-- Pre-check (run manually before applying if unsure about historical duplicates):
-- SELECT "date","apiPath","model",
--        COALESCE("proxyHost",'') AS proxy_host,
--        COALESCE("authSource",'') AS auth_source,
--        COALESCE("authIndex",-1) AS auth_index,
--        COALESCE("authFailed",false) AS auth_failed,
--        COUNT(*) AS cnt
-- FROM "UsageDaily"
-- GROUP BY 1,2,3,4,5,6,7
-- HAVING COUNT(*) > 1;

-- Add composite unique index treating NULLs as equal for UsageDaily upsert idempotency
CREATE UNIQUE INDEX "UsageDaily_composite_key_nnd"
ON "UsageDaily" (
  "date",
  "apiPath",
  "model",
  COALESCE("proxyHost", ''),
  COALESCE("authSource", ''),
  COALESCE("authIndex", -1),
  COALESCE("authFailed", false)
);

-- Improve time-range filtering for usage aggregation/backfill
CREATE INDEX "UsageEvent_eventTime_model_idx"
ON "UsageEvent" ("eventTime", "model");
