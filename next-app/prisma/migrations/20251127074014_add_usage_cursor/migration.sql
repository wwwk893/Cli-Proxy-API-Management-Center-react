-- CreateTable
CREATE TABLE "UsageIngestCursor" (
    "id" TEXT NOT NULL DEFAULT 'cliproxy',
    "lastEventAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UsageIngestCursor_pkey" PRIMARY KEY ("id")
);
