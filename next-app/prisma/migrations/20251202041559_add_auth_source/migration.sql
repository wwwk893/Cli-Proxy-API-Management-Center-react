-- DropIndex
DROP INDEX "UsageEvent_status_idx";

-- AlterTable
ALTER TABLE "ModelPricing" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "UsageDaily" ADD COLUMN     "authFailed" BOOLEAN DEFAULT false,
ADD COLUMN     "authIndex" INTEGER,
ADD COLUMN     "authSource" TEXT;

-- AlterTable
ALTER TABLE "UsageEvent" ADD COLUMN     "authFailed" BOOLEAN DEFAULT false,
ADD COLUMN     "authIndex" INTEGER,
ADD COLUMN     "authSource" TEXT;

-- CreateIndex
CREATE INDEX "UsageEvent_authSource_createdAt_idx" ON "UsageEvent"("authSource", "createdAt");
