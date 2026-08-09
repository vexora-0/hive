import { createHash } from 'crypto';
import { Request } from 'express';
import rateLimit from 'express-rate-limit';

/**
 * Rate-limit key: the caller, not their network.
 *
 * Keying on IP alone punishes the normal case. Mobile clients sit behind
 * carrier-grade NAT, so an entire city block can share one source address and
 * collectively trip a per-IP budget none of them individually came close to.
 *
 * When a bearer token is present we key on a hash of it instead, which is one
 * key per signed-in user wherever they are. The token is read straight off the
 * header — this runs before `authenticate`, so it is deliberately *not* a
 * claim that the token is valid, only a stable identifier to meter against. A
 * forged token still gets metered; it just gets its own bucket, and it is
 * rejected a moment later by `authenticate` regardless.
 *
 * Unauthenticated callers still fall back to IP, which is all we have.
 */
function callerKey(req: Request): string {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    return 'u:' + createHash('sha256').update(auth.slice(7)).digest('hex').slice(0, 32);
  }
  return 'ip:' + (req.ip ?? req.headers['x-forwarded-for']?.toString() ?? 'unknown');
}

/**
 * The global budget.
 *
 * 1000 per 15 minutes is generous per user and still bounds abuse. The old
 * figure of 100 was set as if a request were a page view: opening the parent
 * feed alone costs a feed page, an unread count, a notification list and a
 * profile read, so a normal session ran out within a few minutes of ordinary
 * scrolling.
 *
 * `/health` is exempt. It is polled by the platform, shares the IP bucket of
 * whatever else is on that address, and a 429 there reads as "instance down"
 * and pulls it out of rotation.
 */
export const globalRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => req.path === '/health',
  message: {
    success: false,
    message: 'Too many requests, please try again later',
    code: 'RATE_LIMITED',
  },
  keyGenerator: callerKey,
});

/**
 * A tighter budget for endpoints that create or mutate expensive resources.
 * Uploads and order creation are the ones worth metering separately: both cost
 * storage or money, and neither is issued in bursts by a legitimate client.
 */
export const writeRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests, please slow down',
    code: 'RATE_LIMITED',
  },
  keyGenerator: callerKey,
});
