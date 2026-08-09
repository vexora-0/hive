import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

export const redis = new Redis(env.REDIS_URL, {
  // Fail the command rather than queue it forever.
  //
  // `maxRetriesPerRequest: null` was set for BullMQ, which requires it — and
  // BullMQ was removed in Plan 03. What it left behind was a hang: combined
  // with ioredis's offline queue, a command issued while Redis is unreachable
  // is retried indefinitely and never settles. Redis is only used by the
  // idempotency middleware, which runs *before* the order handler, so a Redis
  // outage did not degrade order submission — it made `POST /orders` hang
  // open with no response and no error. Observed during this session: over two
  // minutes with nothing returned.
  //
  // The middleware already catches Redis failures and continues without
  // idempotency, which is the right trade — an order placed twice is
  // recoverable, an order that never returns is not. It just never got the
  // chance, because the failure never arrived.
  maxRetriesPerRequest: 2,
  enableOfflineQueue: false,
  connectTimeout: 3000,
  enableReadyCheck: false,
  retryStrategy(times: number) {
    const delay = Math.min(times * 200, 5000);
    logger.warn(`Redis reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
});

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (err) => {
  logger.error('Redis connection error', { error: err.message });
});
