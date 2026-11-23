import { config } from "./config";
import { createServer } from "./server";
import { startWorker } from "./worker";
import { emailQueue } from "./queue";
import { initDb, pool } from "./db";

async function main() {
  await initDb();
  const worker = startWorker();
  const app = createServer();
  const server = app.listen(config.port, () =>
    console.log(`API running at http://localhost:${config.port}`)
  );

  // Graceful shutdown: active jobs finish; waiting/delayed jobs stay safe in Redis
  const shutdown = async () => {
    console.log("Shutting down...");
    server.close();
    await worker.close();
    await emailQueue.close();
    await pool.end();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
