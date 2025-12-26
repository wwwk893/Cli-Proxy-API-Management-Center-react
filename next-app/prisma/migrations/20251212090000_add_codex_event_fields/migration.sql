-- 为 Codex 会话采集扩展 UsageEvent 维度字段
ALTER TABLE "UsageEvent"
  ADD COLUMN "sourceType" TEXT,
  ADD COLUMN "sessionId" TEXT,
  ADD COLUMN "cwd" TEXT,
  ADD COLUMN "originator" TEXT,
  ADD COLUMN "cliVersion" TEXT,
  ADD COLUMN "effort" TEXT;

-- 新增索引以支持按 source/session/cwd 维度检索
CREATE INDEX "UsageEvent_sourceType_eventTime_idx" ON "UsageEvent"("sourceType", "eventTime");
CREATE INDEX "UsageEvent_sessionId_eventTime_idx" ON "UsageEvent"("sessionId", "eventTime");
CREATE INDEX "UsageEvent_cwd_eventTime_idx" ON "UsageEvent"("cwd", "eventTime");

-- 现有历史数据默认视为 cliproxy 来源
UPDATE "UsageEvent"
SET "sourceType" = 'cliproxy'
WHERE "sourceType" IS NULL;
