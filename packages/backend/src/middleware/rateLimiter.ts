import { createHash } from 'crypto';
import { Request, RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';

const WINDOW_MS = 15 * 60 * 1000;

/**
 * Per-IP ceiling on the global limiter.
 *
 * Deliberately loose. Mobile clients sit behind carrier-grade NAT, so an entire
 * city block can share one source address, and a tight per-IP budget bills all
 * of them for each other's traffic. This is not the budget a normal user is
 * expected to feel — that is PER_TOKEN_MAX below — it is the ceiling that stops
 * one address from consuming the instance.
 */
const GLOBAL_PER_IP_MAX = 5000;

/**
 * Per-token budget on the global limiter.
 *
 * 1000 per 15 minutes is generous for one signed-in user. The old figure of 100
 * was set as if a request were a page view: opening the parent feed alone costs
 * a feed page, an unread count, a notification list and a profile read, so a
 * normal session ran out within a few minutes of ordinary scrolling.
 */
const PER_TOKEN_MAX = 1000;

/** Tighter budgets for routes that create or mutate expensive resources. */
const WRITE_PER_IP_MAX = 500;
const WRITE_PER_IDENTITY_MAX = 100;

/**
 * `/health` is exempt. It is polled by the platform, shares the IP bucket of
 * whatever else is on that address, and a 429 there reads as "instance down"
 * and pulls the instance out of rotation.
 */
function isHealthCheck(req: Request): boolean {
  return req.path === '/health';
}

function bearerToken(req: Request): string | null {
  const auth = req.headers.authorization;
  return auth?.startsWith('Bearer ') ? auth.slice(7) : null;
}

function ipKey(req: Request): string {
  return 'ip:' + (req.ip ?? req.headers['x-forwarded-for']?.toString() ?? 'unknown');
}

/**
 * A stable identifier for the caller, NOT a claim that they are who they say.
 *
 * `authenticate` has already run on the write routes, so `req.user.id` is a
 * verified subject there and is preferred: it survives token rotation, so a
 * user cannot reset their write budget by refreshing their session.
 *
 * On the global limiter, which runs before `authenticate`, only the raw token
 * is available and it is unverified. That is why this key is never used alone
 * — see `bothMustPass`.
 */
function identityKey(req: Request): string {
  if (req.user?.id) return 'user:' + req.user.id;
  const token = bearerToken(req);
  if (token) return 'tok:' + createHash('sha256').update(token).digest('hex').slice(0, 32);
  return ipKey(req);
}

const TOO_MANY = {
  success: false,
  message: 'Too many requests, please try again later',
  code: 'RATE_LIMITED',
};

/**
 * Every request must pass an IP bucket AND an identity bucket.
 *
 * The identity bucket alone was a hole rather than a refinement. The global
 * limiter is `app.use`d before `authenticate`, so the token it keyed on was
 * never checked against anything: an unauthenticated caller sending
 * `Authorization: Bearer <random>` — a fresh random per request — got a fresh
 * empty bucket every time and was never limited at all, on any route. The
 * previous comment reasoned that a forged token "still gets metered, it just
 * gets its own bucket", which is exactly the problem: a bucket per request is
 * not a limit. Raising max from 100 to 1000 made the ceiling higher still.
 *
 * The IP bucket closes it because a forger cannot forge their source address,
 * and layering the two keeps the reason the identity bucket was introduced:
 * one NAT'd user is still metered on their own token rather than on the
 * thousand strangers sharing their egress address.
 */
function bothMustPass(
  ipMax: number,
  identityMax: number,
  skip: (req: Request) => boolean = () => false,
): RequestHandler[] {
  const common = {
    windowMs: WINDOW_MS,
    standardHeaders: true as const,
    legacyHeaders: false,
    message: TOO_MANY,
  };

  return [
    rateLimit({ ...common, max: ipMax, keyGenerator: ipKey, skip }),
    rateLimit({ ...common, max: identityMax, keyGenerator: identityKey, skip }),
  ];
}

/** The global budget, applied to every route. */
export const globalRateLimiter: RequestHandler[] = bothMustPass(
  GLOBAL_PER_IP_MAX,
  PER_TOKEN_MAX,
  isHealthCheck,
);

/**
 * A tighter budget for endpoints that create or mutate expensive resources.
 * Uploads and order creation are the ones worth metering separately: both cost
 * storage or money, and neither is issued in bursts by a legitimate client.
 *
 * These routes sit behind `authenticate`, so the identity bucket here keys on a
 * verified user id.
 */
export const writeRateLimiter: RequestHandler[] = bothMustPass(
  WRITE_PER_IP_MAX,
  WRITE_PER_IDENTITY_MAX,
);
