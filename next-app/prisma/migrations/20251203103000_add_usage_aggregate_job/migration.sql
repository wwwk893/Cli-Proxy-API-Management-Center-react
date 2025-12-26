-- CreateTable
CREATE TABLE "UsageAggregateJob" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    "kind" TEXT NOT NULL,
    "rangeFrom" TIMESTAMP(3) NOT NULL,
    "rangeTo" TIMESTAMP(3) NOT NULL,

    "status" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "workerId" TEXT,
    "lockedAt" TIMESTAMP(3),
    "executionMs" INTEGER,

    "lastError" TEXT,
    "summary" TEXT,

    CONSTRAINT "UsageAggregateJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsageAggregateJob_kind_rangeFrom_key" ON "UsageAggregateJob"("kind", "rangeFrom");
CREATE INDEX "UsageAggregateJob_status_rangeFrom_idx" ON "UsageAggregateJob"("status", "rangeFrom");

-- CreateIndex
CREATE UNIQUE INDEX "daily_composite_key" ON "UsageDaily"("date", "apiPath", "model", "proxyHost", "authSource", "authIndex", "authFailed");
