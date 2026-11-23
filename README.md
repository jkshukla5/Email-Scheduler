# Email Job Scheduler (BullMQ + Redis + Postgres + React)

## Run
1. `docker compose up -d`            # Redis + Postgres
2. `npm install && npm run dev`      # backend + worker on :3000
3. `cd frontend && npm install && npm run dev`   # dashboard on :5173

Open http://localhost:5173

## API
POST /api/emails/schedule
{ "to":"a@b.com", "subject":"Hi", "body":"Hello", "sendAt":"2026-11-23T18:30:00Z", "idempotencyKey":"optional" }

GET /api/emails?status=scheduled|sending|sent|failed
GET /api/stats

## Design
- Scheduling: BullMQ delayed jobs in Redis (no cron). Redis AOF persistence is on.
- Postgres: source of truth for the dashboard (status, attempts, errors, preview URL).
- Restart safety: delayed jobs live in Redis and resume automatically; DB history is kept.
- Idempotency: email id = idempotencyKey (Postgres PK + BullMQ jobId); duplicates are ignored.
- Rate limit: per-sender hourly counter in Redis; excess jobs move to the next hour (not dropped).
- Min delay between emails: BullMQ worker limiter. Concurrency: WORKER_CONCURRENCY.
- Retries: 3 attempts with exponential backoff.
- Email: Ethereal fake SMTP, preview URL stored and shown in dashboard.
