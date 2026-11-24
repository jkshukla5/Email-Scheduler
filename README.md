

# Email Job Scheduler (BullMQ + Redis + Postgres + React)

Demo video: https://drive.google.com/file/d/1Rj2CjhHEA4-uOo9qUUmkvO0Q8apZ8OmZ/view?usp=sharing

Live demo: https://email-scheduler-mfe9.onrender.com

Note: Render's free plan blocks outbound SMTP, so email sending is shown in the demo video (local run).


A production-style email scheduler. Emails are scheduled through an API, stored as
delayed BullMQ jobs in Redis (no cron jobs), and sent through Ethereal fake SMTP.
Scheduled jobs survive server restarts.

## Tech stack
- Backend: Node.js, Express, TypeScript, BullMQ, Redis, Nodemailer (Ethereal)
- Database: PostgreSQL (email history and status)
- Frontend: React, Vite, Tailwind CSS

## Setup

1. Start Redis and Postgres with Docker:
   `docker compose up -d`
   (No Docker? Use Redis Cloud and Neon Postgres and put their URLs in `.env`.)
2. Copy `.env.example` to `.env` and set `REDIS_URL` and `DATABASE_URL`.
3. Backend (API + worker on port 3000):
   `npm install` then `npm run dev`
4. Frontend (dashboard on port 5173):
   `cd frontend` then `npm install` then `npm run dev`
5. Open http://localhost:5173

## API

Schedule an email:

    POST /api/emails/schedule
    {
      "to": "a@b.com",
      "subject": "Hi",
      "body": "Hello",
      "sendAt": "2026-11-25T18:30:00Z",
      "idempotencyKey": "optional"
    }

List emails: `GET /api/emails?status=scheduled|sending|sent|failed`

Stats: `GET /api/stats`

## Design
- Scheduling: BullMQ delayed jobs stored in Redis, no cron.
- Persistence: delayed jobs live in Redis, so they resume after a server restart.
- History: Postgres stores status, attempts, errors and the Ethereal preview URL.
- Idempotency: the email id is the idempotencyKey, so duplicate requests are ignored.
- Rate limit: hourly limit per sender kept in Redis. Extra jobs move to the next hour, they are not dropped.
- Minimum delay between emails and worker concurrency are configurable in `.env`.
- Retries: 3 attempts with exponential backoff.
- Email: Ethereal fake SMTP. Open the preview link in the dashboard to view each sent email.

## Note
Ethereal does not deliver real emails. It captures them in a test inbox.
