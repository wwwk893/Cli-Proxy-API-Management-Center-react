# CLI Proxy Center (Next.js)

Analytics dashboard for proxy usage (tokens, cost, cache hit). Stack: Next.js App Router, Prisma/Postgres, Recharts, shadcn/ui.

## Quick start
1) Install deps
```bash
npm install
```
2) Env vars (see `.env.example`)
3) DB migrate (creates `UsageEvent` + `UsageIngestCursor`)
```bash
npx prisma migrate deploy
```
4) Dev server
```bash
npm run dev
```

## Usage ingestion
Source of truth: management API `CLIPROXY_MANAGEMENT_BASE/usage` with bearer `CLIPROXY_MANAGEMENT_KEY`.

### Manual API trigger
```
POST /api/usage/ingest?since=2025-11-01T00:00:00Z&max=2000&dryRun=true
```
Returns `{ inserted, skipped, processed, cursorAfter }`.

### Dev auto-ingest (no host cron)
For local development you can run Next dev *plus* an internal loop worker that ingests every minute:
```
npm run dev:with-ingest
```
This spawns `next dev` and `npm run usage:ingest:loop` together. You no longer need macOS launchd/systemd/host cron for local dev. Interval can be tuned via `USAGE_INGEST_LOOP_INTERVAL_SEC` (default 60s). The loop uses the same ingestion logic as the API route and respects `USAGE_INGEST_BACKFILL_SINCE`, `USAGE_INGEST_MAX_EVENTS_PER_RUN`, `USAGE_INGEST_DRY_RUN`. 另外还会同时启动 Codex 会话采集循环（`npm run codex:ingest:loop`），默认每 300 秒执行一次，可通过 `CODEX_INGEST_LOOP_INTERVAL_SEC` 调整。

### CLI / cron
- Dev (ts-node): `npm run usage:ingest:dev`
- After build: `npm run build && npm run usage:ingest`
- Env knobs:
  - `USAGE_INGEST_BACKFILL_SINCE` (ISO)
  - `USAGE_INGEST_MAX_EVENTS_PER_RUN` (default 2000)
  - `USAGE_INGEST_DRY_RUN` (`true` to log only)

Example cron (5 min):
```
*/5 * * * * cd /app/next-app && npm run usage:ingest >> /var/log/usage-ingest.log 2>&1
```

### Docker cron sidecar (ready-made)
- Build & run: `docker compose -f docker-compose.ingest.yml up -d --build`
- Uses image `docker/ingest-cron/Dockerfile`, runs `npm run usage:ingest` every 5 min.
- Reads `.env` via volume mount; logs at `/var/log/usage-ingest.log` inside container.

### Idempotency & cursor
- Writes via `createMany(..., skipDuplicates: true)` keyed by `rawKey`.
- Cursor table `UsageIngestCursor` tracks `lastEventAt`; reruns are safe.

## Theming & i18n
- Theme auto-switch + manual toggle (day/night) via CSS vars.
- i18n (EN/中文) with language toggle in header.

## Env variables (.env.example)
See `.env.example` for the full list (DB, management API, ingest knobs).
