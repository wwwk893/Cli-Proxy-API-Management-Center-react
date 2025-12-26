-- AlterTable
ALTER TABLE "UsageEvent" ADD COLUMN     "status" TEXT;

-- CreateTable
CREATE TABLE "UsageAggregateSnapshot" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "snapshotTime" TIMESTAMP(3) NOT NULL,
    "windowStart" TIMESTAMP(3),
    "windowEnd" TIMESTAMP(3),
    "totalRequests" INTEGER NOT NULL,
    "successCount" INTEGER NOT NULL,
    "failureCount" INTEGER NOT NULL,
    "requestsByDay" JSONB NOT NULL,
    "requestsByHour" JSONB NOT NULL,
    "tokensByDay" JSONB NOT NULL,
    "tokensByHour" JSONB NOT NULL,
    "apis" JSONB NOT NULL,
    "externalCursor" TEXT,

    CONSTRAINT "UsageAggregateSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UsageAggregateSnapshot_externalCursor_key" ON "UsageAggregateSnapshot"("externalCursor");
