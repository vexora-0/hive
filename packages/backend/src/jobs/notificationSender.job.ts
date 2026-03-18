import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';

const QUEUE_NAME = 'notification-sender';

interface NotificationData {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export const notificationQueue = new Queue<NotificationData>(QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

async function processNotification(
  job: Job<NotificationData>,
): Promise<void> {
  const { userId, type, title, body, data } = job.data;

  logger.info('Processing notification', {
    jobId: job.id,
    userId,
    type,
  });

  try {
    // Insert notification record into Supabase
    const { error } = await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      type,
      title,
      body,
      data: data ?? null,
      read: false,
    });

    if (error) {
      throw new Error(`Failed to insert notification: ${error.message}`);
    }

    logger.info('Notification sent', {
      jobId: job.id,
      userId,
      type,
    });
  } catch (err) {
    logger.error('Notification processing failed', {
      jobId: job.id,
      userId,
      type,
      error: err instanceof Error ? err.message : String(err),
    });

    throw err;
  }
}

export function startNotificationWorker(): Worker<NotificationData> {
  const worker = new Worker<NotificationData>(
    QUEUE_NAME,
    processNotification,
    {
      connection: redisConnection,
      concurrency: 5,
    },
  );

  worker.on('completed', (job) => {
    logger.info('Notification job completed', {
      jobId: job.id,
      userId: job.data.userId,
      type: job.data.type,
    });
  });

  worker.on('failed', (job, err) => {
    logger.error('Notification job failed', {
      jobId: job?.id,
      userId: job?.data.userId,
      type: job?.data.type,
      error: err.message,
      attempts: job?.attemptsMade,
    });
  });

  worker.on('error', (err) => {
    logger.error('Notification worker error', {
      error: err.message,
    });
  });

  logger.info('Notification sender worker started');

  return worker;
}
