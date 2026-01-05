import "dotenv/config";
import { ingestUsageFromOpencode } from "@/lib/opencode-ingest";

const DEFAULT_INTERVAL_MS = 300_000;
const intervalMs = (() => {
  const raw = process.env.OPENCODE_INGEST_LOOP_INTERVAL_SEC;
  if (!raw) return DEFAULT_INTERVAL_MS;
  const asNumber = Number(raw);
  return Number.isFinite(asNumber) && asNumber > 0 ? asNumber * 1000 : DEFAULT_INTERVAL_MS;
})();

let running = false;
let stopped = false;

async function runOnce() {
  if (running) {
    console.log("opencode:ingest loop skipped — previous run still in progress");
    return;
  }
  running = true;
  try {
    const result = await ingestUsageFromOpencode();
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
    console.error("opencode:ingest loop iteration failed", err);
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
  console.log(`opencode:ingest loop received ${signal}, stopping timer...`);
  clearInterval(timer);
  await waitForCurrentRun();
  process.exit(0);
}

const timer = setInterval(runOnce, intervalMs);
runOnce();

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

