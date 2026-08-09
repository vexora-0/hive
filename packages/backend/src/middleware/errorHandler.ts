import { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { ZodError } from 'zod';
import { logger } from '../config/logger';
import { Sentry, isSentryEnabled } from '../config/sentry';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    isOperational: boolean = true,
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = isOperational;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/**
 * Send an error to Sentry, if it is configured.
 *
 * Only unexpected errors get here. `AppError` is deliberately excluded: a 403
 * on a cross-school request or a 404 on an unowned photo is the authorization
 * layer working, and reporting those would bury the real failures under
 * thousands of events that mean "the system did its job".
 */
function reportToSentry(err: Error): void {
  if (!isSentryEnabled()) return;
  Sentry.captureException(err);
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  // ZodError
  if (err instanceof ZodError) {
    const errors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));

    res.status(400).json({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors,
    });
    return;
  }

  // AppError (operational)
  if (err instanceof AppError) {
    logger.warn('Operational error', {
      requestId: req.requestId,
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
    });

    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
    });
    return;
  }

  // Client errors raised by middleware before any handler runs — body-parser's
  // SyntaxError on malformed JSON (400) and PayloadTooLargeError (413). Both
  // carry a status but no `code`, so without this they fell through to the
  // unknown branch: a 500 instead of the right 4xx, and reportToSentry on every
  // one. That let any authenticated client fill Sentry and the error log with
  // stack traces just by POSTing garbage — the exact noise reportToSentry
  // exists to keep out.
  const status = (err as { status?: number; statusCode?: number }).statusCode
    ?? (err as { status?: number }).status;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    logger.warn('Malformed request', {
      requestId: req.requestId,
      message: err.message,
      name: err.name,
      status,
    });

    res.status(status).json({
      success: false,
      message:
        status === 413 ? 'Request body is too large' : 'Malformed request body',
      code: status === 413 ? 'PAYLOAD_TOO_LARGE' : 'INVALID_JSON',
    });
    return;
  }

  // Multer upload errors. These must be caught *before* the Supabase branch
  // below: a MulterError carries a string `code` (LIMIT_FILE_SIZE and friends)
  // and no status, so it matched the "has a string code, must be Postgres"
  // test and every oversized or wrong-field upload came back as a 500
  // DATABASE_ERROR — plus a Sentry event for what is plainly client error.
  if (err instanceof MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'The image is larger than the 25MB limit'
        : `Upload rejected: ${err.message}`;

    logger.warn('Upload rejected', {
      requestId: req.requestId,
      code: err.code,
      field: err.field,
    });

    res.status(status).json({ success: false, message, code: err.code });
    return;
  }

  // Supabase errors (they have a `code` property)
  if ('code' in err && typeof (err as Record<string, unknown>).code === 'string') {
    const supaErr = err as Error & { code: string; details?: string };
    logger.error('Supabase error', {
      message: supaErr.message,
      code: supaErr.code,
      details: supaErr.details,
    });
    reportToSentry(supaErr);

    res.status(500).json({
      success: false,
      message: 'A database error occurred',
      code: 'DATABASE_ERROR',
    });
    return;
  }

  // Unknown / unexpected error
  logger.error('Unhandled error', {
    requestId: req.requestId,
    message: err.message,
    stack: err.stack,
    name: err.name,
  });
  reportToSentry(err);

  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
    code: 'INTERNAL_ERROR',
  });
}
