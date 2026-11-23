import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { config } from "./config";
import { emailQueue } from "./queue";
import { pool } from "./db";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUSES = ["scheduled", "sending", "sent", "failed"];

export function createServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // Schedule an email
  app.post("/api/emails/schedule", async (req, res) => {
    try {
      const { to, subject, body, sendAt, sender, idempotencyKey } = req.body || {};

      if (!to || !emailRegex.test(to)) return res.status(400).json({ error: "Valid 'to' email is required" });
      if (!subject) return res.status(400).json({ error: "'subject' is required" });
      if (!body) return res.status(400).json({ error: "'body' is required" });

      const sendTime = sendAt ? new Date(sendAt).getTime() : Date.now();
      if (Number.isNaN(sendTime)) return res.status(400).json({ error: "'sendAt' must be a valid date" });
      const delay = Math.max(0, sendTime - Date.now());
      const from = sender || config.defaultSender;
      const id = idempotencyKey ? String(idempotencyKey) : randomUUID();

      // 1) Save in Postgres. If the id already exists => duplicate request, ignore it.
      const inserted = await pool.query(
        `INSERT INTO emails (id, to_email, subject, body, sender, send_at)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING RETURNING id`,
        [id, to, subject, body, from, new Date(Date.now() + delay)]
      );
      if (inserted.rowCount === 0) return res.status(200).json({ id, duplicate: true });

      // 2) Add delayed job in BullMQ (stored in Redis)
      try {
        await emailQueue.add(
          "send-email",
          { to, subject, body, sender: from },
          {
            jobId: id,
            delay,
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
            removeOnComplete: true,
            removeOnFail: { count: 1000 },
          }
        );
      } catch (e: any) {
        await pool.query("UPDATE emails SET status='failed', error=$2 WHERE id=$1", [id, e.message]);
        throw e;
      }

      res.status(201).json({ id, scheduledFor: new Date(Date.now() + delay).toISOString() });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // List emails. Optional ?status=scheduled|sending|sent|failed
  app.get("/api/emails", async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const hasFilter = status && STATUSES.includes(status);
      const { rows } = await pool.query(
        `SELECT id, to_email AS "to", subject, sender, status, send_at AS "sendAt",
                sent_at AS "sentAt", attempts, error, preview_url AS "previewUrl"
         FROM emails ${hasFilter ? "WHERE status = $1" : ""}
         ORDER BY send_at DESC LIMIT 500`,
        hasFilter ? [status] : []
      );
      res.json(rows);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Counts per status for the dashboard cards
  app.get("/api/stats", async (_req, res) => {
    try {
      const { rows } = await pool.query("SELECT status, COUNT(*)::int AS count FROM emails GROUP BY status");
      const stats: Record<string, number> = { scheduled: 0, sending: 0, sent: 0, failed: 0 };
      rows.forEach((r) => (stats[r.status] = r.count));
      res.json(stats);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  return app;
}
