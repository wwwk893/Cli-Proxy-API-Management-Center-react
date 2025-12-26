// Codex CLI 会话用量采集 CLI 入口：
//   npx tsx scripts/codex-ingest.ts

import "dotenv/config";
import { prisma } from "@/lib/db";
import { ingestUsageFromCodex } from "@/lib/codex-ingest";

const LOCK_KEY = BigInt(491703); // 与 cliproxy ingest 区分的 advisory lock key

async function tryAcquireLock() {
  const rows = await prisma.$queryRawUnsafe<{ pg_try_advisory_lock: boolean }[]>(
    `SELECT pg_try_advisory_lock(${LOCK_KEY});`,
  );
  return rows?.[0]?.pg_try_advisory_lock === true;
}

async function releaseLock() {
  await prisma.$queryRawUnsafe(`SELECT pg_advisory_unlock(${LOCK_KEY});`);
}

async function main() {
  const locked = await tryAcquireLock();
  if (!locked) {
    console.warn("codex:ingest skipped — another run is in progress (advisory lock held)");
    return;
  }

  try {
    const result = await ingestUsageFromCodex();
    const now = new Date().toISOString();
    console.log(
      JSON.stringify(
        {
          ts: now,
          ok: true,
          ...result,
        },
        null,
        2,
      ),
    );
  } finally {
    await releaseLock();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

