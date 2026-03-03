import { Request, Response, NextFunction } from 'express';
import { redis } from '../config/redis';
import { logger } from '../config/logger';

const IDEMPOTENCY_TTL = 24 * 60 * 60; // 24 hours in seconds
const KEY_PREFIX = 'idempotency:';

interface CachedResponse {
  status: number;
  body: unknown;
}

export async function idempotency(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const idempotencyKey = req.headers['x-idempotency-key'] as
    | string
    | undefined;

  if (!idempotencyKey) {
    res.status(400).json({
      success: false,
      message: 'X-Idempotency-Key header is required',
      code: 'MISSING_IDEMPOTENCY_KEY',
    });
    return;
  }

  const cacheKey = `${KEY_PREFIX}${req.user?.id ?? 'anon'}:${idempotencyKey}`;

  try {
    const cached = await redis.get(cacheKey);

    if (cached) {
      const cachedResponse: CachedResponse = JSON.parse(cached);
      logger.debug('Returning cached idempotent response', {
        key: idempotencyKey,
      });
      res.status(cachedResponse.status).json(cachedResponse.body);
      return;
    }

    // Mark as in-progress to prevent concurrent requests with the same key
    const lockKey = `${cacheKey}:lock`;
    const acquired = await redis.set(lockKey, '1', 'EX', 30, 'NX');

    if (!acquired) {
      res.status(409).json({
        success: false,
        message: 'A request with this idempotency key is already being processed',
        code: 'DUPLICATE_REQUEST',
      });
      return;
    }

    // Intercept res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = ((body: unknown) => {
      const responseToCache: CachedResponse = {
        status: res.statusCode,
        body,
      };

      redis
        .set(cacheKey, JSON.stringify(responseToCache), 'EX', IDEMPOTENCY_TTL)
        .then(() => redis.del(lockKey))
        .catch((err) => {
          logger.error('Failed to cache idempotent response', {
            key: idempotencyKey,
            error: err.message,
          });
        });

      return originalJson(body);
    }) as Response['json'];

    next();
  } catch (err) {
    logger.error('Idempotency middleware error', { error: err });
    next();
  }
}
