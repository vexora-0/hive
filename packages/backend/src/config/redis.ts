import Redis from 'ioredis';
import { env } from './env';
import { logger } from './logger';

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times: number) {
    const delay = Math.min(times * 200, 5000);
    logger.warn(`Redis reconnecting in ${delay}ms (attempt ${times})`);
    return delay;
  },
});

// Connection options object for BullMQ (avoids ioredis version mismatch)
export const redisConnection = { url: env.REDIS_URL };

redis.on('connect', () => {
  logger.info('Redis connected');
});

redis.on('error', (err) => {
  logger.error('Redis connection error', { error: err.message });
});
