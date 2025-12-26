import "dotenv/config";
import { ingestUsageFromProxy } from "@/lib/usage-ingest";
import { serverEnv } from "@/lib/env";

const DEFAULT_INTERVAL_MS = 300_000;
const intervalMs = (() => {
  const raw = process.env.USAGE_INGEST_LOOP_INTERVAL_SEC;
  if (!raw) return DEFAULT_INTERVAL_MS;
  const asNumber = Number(raw);
  return Number.isFinite(asNumber) && asNumber > 0 ? asNumber * 1000 : DEFAULT_INTERVAL_MS;
})();

let running = false;
let stopped = false;

function getProxyHost() {
  const url = new URL(serverEnv.CLIPROXY_MANAGEMENT_BASE);
  return url.host;
}

async function runOnce() {
  if (running) {
    console.log("usage:ingest loop skipped — previous run still in progress");
    return;
  }
  running = true;
  try {
    const result = await ingestUsageFromProxy({
      proxyHost: getProxyHost(),
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
  } catch (err) {
    console.error("usage:ingest loop iteration failed", err);
  } finally {
    running = false;
  }
}

function waitForCurrentRun() {
  return new Promise<void>((resolve) => {
    if (!running) return resolve();
    const handle = setInterval(() => {
      if (!running) {
        clearInterval(handle);
        resolve();
      }
    }, 250);
  });
}

async function shutdown(signal: string) {
  if (stopped) return;
  stopped = true;
  console.log(`usage:ingest loop received ${signal}, stopping timer...`);
  clearInterval(timer);
  await waitForCurrentRun();
  process.exit(0);
}

const timer = setInterval(runOnce, intervalMs);
runOnce();

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
