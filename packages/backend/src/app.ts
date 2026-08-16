import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { globalRateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { requestId } from './middleware/requestId';
import { supabaseAdmin } from './config/supabase';
import { redis } from './config/redis';
import { logger } from './config/logger';

// Import route modules
import photoRoutes from './routes/photo.routes';
import feedRoutes from './routes/feed.routes';
import orderRoutes from './routes/order.routes';
import notificationRoutes from './routes/notification.routes';
import adminRoutes from './routes/admin.routes';
import schoolsRoutes from './routes/schools.routes';
import profileRoutes from './routes/profile.routes';

const app: Express = express();

// Trust exactly one proxy hop (ngrok in development, the platform load balancer
// in production) so req.protocol / req.hostname are correct.
//
// Must NOT be `true`. That trusts every hop, which means req.ip is taken from a
// client-controlled X-Forwarded-For header — and the rate limiter keys on req.ip,
// so a client could rotate that header to bypass rate limiting entirely.
app.set('trust proxy', 1);

// Correlation ID first, so every later log line and error carries it.
app.use(requestId);

// Security headers
app.use(helmet());

// CORS
// `credentials: true` alongside `origin: '*'` is rejected outright by every
// browser, so the permissive default configuration broke any browser client
// rather than being permissive to it. Credentials are only meaningful with an
// explicit allow-list; the mobile app authenticates with a bearer token and
// needs none.
const allowAnyOrigin = env.CORS_ORIGINS === '*';
const corsOptions: cors.CorsOptions = {
  origin: allowAnyOrigin ? '*' : (env.CORS_ORIGINS as string[]),
  credentials: !allowAnyOrigin,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Idempotency-Key',
    'X-Request-ID',
  ],
};
app.use(cors(corsOptions));

// Body parsing with 1MB limit
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Global rate limiter
app.use(globalRateLimiter);

// Request logging.
//
// Logged at `info`, not `debug` — the production level is `info`, so the
// previous debug call meant production had no request log at all. Emitted on
// response finish so status and duration are known.
app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    // originalUrl, not path: inside a mounted router req.path is relative to
    // the mount point, so /api/v1/feed logged as "GET /" and /api/v1/orders as
    // "POST /". Errors that reach the error handler logged the full path, so
    // the same stream held both forms. This is the only forensic surface there
    // is — security.md §8.4 notes there is no audit log — and a line reading
    // "POST / returned 201" identifies nothing.
    logger.info(`${req.method} ${req.originalUrl}`, {
      requestId: req.requestId,
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      userAgent: req.headers['user-agent'],
    });
  });
  next();
});

// Health check.
//
// Actually verifies the database, so a backend that cannot reach Supabase
// reports unhealthy instead of letting the platform keep routing traffic to it.
// Deliberately returns a boolean only — this endpoint is public and must not
// leak connection details.
app.get('/health', async (_req, res) => {
  let database: 'ok' | 'error' = 'error';
  try {
    // The probe carries its own catch before it is raced.
    //
    // Promise.race abandons the loser, it does not cancel it. If the query lost
    // the race and then rejected, nothing was attached to handle it, so it
    // became an unhandled rejection — and index.ts responds to those by exiting
    // the process. A slow database could therefore kill the very instance the
    // health check exists to report on.
    const probe = supabaseAdmin
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .then(
        ({ error }) => ({ error: error as unknown as Error | null }),
        (err: unknown) => ({ error: err instanceof Error ? err : new Error(String(err)) }),
      );

    const { error } = await Promise.race([
      probe,
      new Promise<{ error: Error | null }>((resolve) =>
        setTimeout(() => resolve({ error: new Error('timeout') }), 2000),
      ),
    ]);
    if (!error) database = 'ok';
  } catch {
    database = 'error';
  }

  // Redis is reported but deliberately does NOT affect the status code. It
  // backs only the order idempotency cache, and losing that degrades to
  // "orders are not deduplicated" rather than to an outage — so an instance
  // without Redis should stay in rotation. It is surfaced because the previous
  // response said nothing about it at all, and a Redis failure was therefore
  // invisible until it showed up as a stalled order.
  let cache: 'ok' | 'error' = 'error';
  try {
    const pong = await Promise.race([
      redis.ping(),
      new Promise<string>((resolve) => setTimeout(() => resolve('timeout'), 1000)),
    ]);
    if (pong === 'PONG') cache = 'ok';
  } catch {
    cache = 'error';
  }

  res.status(database === 'ok' ? 200 : 503).json({
    status: database === 'ok' ? 'ok' : 'degraded',
    service: 'hive-backend',
    version: '1.0.0',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    checks: { database, cache },
  });
});

// API v1 routes
app.use('/api/v1/photos', photoRoutes);
app.use('/api/v1/feed', feedRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/schools', schoolsRoutes);
app.use('/api/v1/me', profileRoutes);

// A route that reliably throws, registered only when FORCE_500_PATH is set.
//
// scripts/verify-security.sh §7 asserts that a 500 returns a generic body and
// carries no stack trace. Until now that check could only skip, because nothing
// in the application 500s on demand — so the one property the error handler
// exists to guarantee was the one property never verified over HTTP.
//
// Deliberately not a fixed path. The route exists only when an operator sets
// the variable, and they choose where it lives, so a deployment that does not
// set it has no such endpoint to find. It is placed after the API routes and
// before the 404 handler, and throws synchronously so Express hands it to
// errorHandler exactly as an unexpected fault would arrive.
//
// It is also, necessarily, a Sentry-event generator. The throw lands in
// errorHandler's unknown branch, which calls reportToSentry — that is the whole
// point, since the branch under test is the one that reports. This file has
// been bitten by that shape before: see the comment in errorHandler.ts about
// malformed bodies falling through to the unknown branch and letting any
// authenticated client fill Sentry with stack traces by POSTing garbage.
//
// What bounds it here is that the route sits behind `globalRateLimiter`
// (mounted above), so it inherits the per-identity budget like everything else.
// If this is ever moved above that middleware, or the limiter is relaxed, an
// operator who left the variable set has handed anyone who learns the path a
// cheap way to burn the Sentry quota. Keep it below line 62.
if (env.FORCE_500_PATH) {
  logger.warn('FORCE_500_PATH is set — registering a route that throws', {
    path: env.FORCE_500_PATH,
  });
  app.get(env.FORCE_500_PATH, () => {
    throw new Error('Forced failure for error-handler verification');
  });
}

// 404 handler for unmatched routes
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    code: 'NOT_FOUND',
  });
});

// Global error handler (must be last)
app.use(errorHandler);

export default app;
