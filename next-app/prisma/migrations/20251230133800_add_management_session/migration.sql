-- CreateTable
CREATE TABLE "ManagementSession" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    "tokenHash" TEXT NOT NULL,
    "serverBase" TEXT NOT NULL,

    "keyCiphertext" BYTEA NOT NULL,
    "keyIv" BYTEA NOT NULL,
    "keyTag" BYTEA NOT NULL,

    CONSTRAINT "ManagementSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ManagementSession_tokenHash_key" ON "ManagementSession"("tokenHash");
CREATE INDEX "ManagementSession_expiresAt_idx" ON "ManagementSession"("expiresAt");
