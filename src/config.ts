import "dotenv/config";

export const config = {
  port: Number(process.env.PORT || 3000),
  redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
  databaseUrl:
    process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/emails",
  concurrency: Number(process.env.WORKER_CONCURRENCY || 5),
  minDelayMs: Number(process.env.MIN_DELAY_MS || 2000),
  maxPerHour: Number(process.env.MAX_EMAILS_PER_HOUR || 100),
  defaultSender: process.env.DEFAULT_SENDER || "hello@reachinbox-demo.com",
};
