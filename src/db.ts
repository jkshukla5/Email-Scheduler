import { Pool } from "pg";
import { config } from "./config";

export const pool = new Pool({ connectionString: config.databaseUrl });

// Creates the table on startup if it does not exist yet.
export async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS emails (
      id          TEXT PRIMARY KEY,          -- same as BullMQ job id (also idempotency key)
      to_email    TEXT NOT NULL,
      subject     TEXT NOT NULL,
      body        TEXT NOT NULL,
      sender      TEXT NOT NULL,
      status      TEXT NOT NULL DEFAULT 'scheduled',  -- scheduled | sending | sent | failed
      send_at     TIMESTAMPTZ NOT NULL,
      sent_at     TIMESTAMPTZ,
      attempts    INT NOT NULL DEFAULT 0,
      error       TEXT,
      preview_url TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS emails_status_idx ON emails (status);
    CREATE INDEX IF NOT EXISTS emails_send_at_idx ON emails (send_at);
  `);
  console.log("[db] Postgres ready");
}
