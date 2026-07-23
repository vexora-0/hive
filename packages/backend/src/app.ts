import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { globalRateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { requestId } from './middleware/requestId';
import { supabaseAdmin } from './config/supabase';
import { logger } from './config/logger';

// Import route modules
import photoRoutes from './routes/photo.routes';
import feedRoutes from './routes/feed.routes';
import orderRoutes from './routes/order.routes';
import notificationRoutes from './routes/notification.routes';
import adminRoutes from './routes/admin.routes';
import schoolsRoutes from './routes/schools.routes';

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
const corsOptions: cors.CorsOptions = {
  origin: env.CORS_ORIGINS === '*' ? '*' : (env.CORS_ORIGINS as string[]),
  credentials: true,
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
    const { error } = await Promise.race([
      supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
      new Promise<{ error: Error }>((resolve) =>
        setTimeout(() => resolve({ error: new Error('timeout') }), 2000),
      ),
    ]);
    if (!error) database = 'ok';
  } catch {
    database = 'error';
  }

  res.status(database === 'ok' ? 200 : 503).json({
    status: database === 'ok' ? 'ok' : 'degraded',
    service: 'hive-backend',
    version: '1.0.0',
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
    checks: { database },
  });
});

// API v1 routes
app.use('/api/v1/photos', photoRoutes);
app.use('/api/v1/feed', feedRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/schools', schoolsRoutes);

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
