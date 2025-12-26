// Simple CLI runner for ingestion. Run with:
//   npx ts-node scripts/usage-ingest.ts
// or build then: node dist/scripts/usage-ingest.js

import "dotenv/config";
import { serverEnv } from "@/lib/env";
import { ingestUsageFromProxy } from "../lib/usage-ingest";
import { prisma } from "@/lib/db";

const LOCK_KEY = BigInt(491702); // arbitrary unique key for usage ingest

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
    console.warn("usage:ingest skipped — another run is in progress (advisory lock held)");
    return;
  }

  const proxyBase = serverEnv.CLIPROXY_MANAGEMENT_BASE;

  const url = new URL(proxyBase);
  const proxyHost = url.host;

  try {
    const result = await ingestUsageFromProxy({
      proxyHost,
      backfillSince: serverEnv.USAGE_INGEST_BACKFILL_SINCE,
      maxEvents: serverEnv.USAGE_INGEST_MAX_EVENTS_PER_RUN,
      dryRun: serverEnv.USAGE_INGEST_DRY_RUN,
    });

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
