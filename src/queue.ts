import { Queue } from "bullmq";
import IORedis from "ioredis";
import { config } from "./config";

export const QUEUE_NAME = "email-queue";

export interface EmailJobData {
  to: string;
  subject: string;
  body: string;
  sender: string;
}

// BullMQ requires maxRetriesPerRequest: null
export const connection = new IORedis(config.redisUrl, {
  maxRetriesPerRequest: null,
});

export const emailQueue = new Queue<EmailJobData>(QUEUE_NAME, { connection });
