import 'dotenv/config';
// Validate environment variables at startup (throws on invalid)
import { env } from './config/env';
import { logger } from './config/logger';
import app from './app';
import { redis } from './config/redis';
import { startImageProcessingWorker } from './jobs/imageProcessor.job';
import { startNotificationWorker } from './jobs/notificationSender.job';

const server = app.listen(env.PORT, () => {
  logger.info(`Hive backend started`, {
    port: env.PORT,
    env: env.NODE_ENV,
    pid: process.pid,
  });
});

// Start background workers
const imageWorker = startImageProcessingWorker();
const notificationWorker = startNotificationWorker();

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  // Stop accepting new connections
  server.close(() => {
    logger.info('HTTP server closed');
  });

  try {
    // Close workers
    await imageWorker.close();
    logger.info('Image processing worker closed');

    await notificationWorker.close();
    logger.info('Notification worker closed');

    // Close Redis connection
    await redis.quit();
    logger.info('Redis connection closed');

    logger.info('Graceful shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown', {
      error: err instanceof Error ? err.message : String(err),
    });
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  logger.error('Uncaught exception', {
    message: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  process.exit(1);
});

export default server;
