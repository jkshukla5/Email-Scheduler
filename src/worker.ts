import { Worker, DelayedError } from "bullmq";
import { config } from "./config";
import { connection, QUEUE_NAME, EmailJobData } from "./queue";
import { sendMail } from "./mailer";
import { pool } from "./db";

export function startWorker() {
  const worker = new Worker<EmailJobData>(
    QUEUE_NAME,
    async (job, token) => {
      const { sender } = job.data;

      // ---- Hourly rate limit per sender (counter lives in Redis) ----
      const hour = Math.floor(Date.now() / 3_600_000);
      const key = `rate:${sender}:${hour}`;
      const count = await connection.incr(key);
      if (count === 1) await connection.expire(key, 3700);

      if (count > config.maxPerHour) {
        await connection.decr(key);
        const nextTs = (hour + 1) * 3_600_000 + Math.floor(Math.random() * 5000);
        await pool.query("UPDATE emails SET status='scheduled', send_at=$2 WHERE id=$1", [
          job.id,
          new Date(nextTs),
        ]);
        await job.moveToDelayed(nextTs, token);
        console.log(`[worker] Rate limit hit for ${sender}, job ${job.id} moved to next hour`);
        throw new DelayedError();
      }

      await pool.query("UPDATE emails SET status='sending', attempts=$2 WHERE id=$1", [
        job.id,
        job.attemptsMade + 1,
      ]);

      try {
        return await sendMail(job.data);
      } catch (err) {
        await connection.decr(key); // failed sends don't count toward the limit
        throw err;
      }
    },
    {
      connection,
      concurrency: config.concurrency,
      limiter: { max: 1, duration: config.minDelayMs }, // minimum gap between emails
    }
  );

  worker.on("completed", async (job, result: any) => {
    await pool.query(
      "UPDATE emails SET status='sent', sent_at=now(), preview_url=$2, error=NULL WHERE id=$1",
      [job.id, result?.previewUrl || null]
    );
    console.log(`[worker] Job ${job.id} sent`);
  });

  worker.on("failed", async (job, err) => {
    if (!job) return;
    const isFinal = job.attemptsMade >= (job.opts.attempts ?? 1);
    await pool.query("UPDATE emails SET status=$2, error=$3, attempts=$4 WHERE id=$1", [
      job.id,
      isFinal ? "failed" : "scheduled", // not final => BullMQ will retry with backoff
      err.message,
      job.attemptsMade,
    ]);
    console.log(`[worker] Job ${job.id} failed (${job.attemptsMade}): ${err.message}`);
  });

  return worker;
}
