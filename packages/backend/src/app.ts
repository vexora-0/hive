import path from 'path';
import express, { Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { globalRateLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
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

// Request logging
app.use((req, _res, next) => {
  logger.debug(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  next();
});

// Serve uploaded photos as static files
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'hive-backend',
    version: '1.0.0',
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
