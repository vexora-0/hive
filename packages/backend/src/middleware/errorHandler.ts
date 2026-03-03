import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../config/logger';

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

export function errorHandler(
  err: Error,
  _req: Request,
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

  // Supabase errors (they have a `code` property)
  if ('code' in err && typeof (err as Record<string, unknown>).code === 'string') {
    const supaErr = err as Error & { code: string; details?: string };
    logger.error('Supabase error', {
      message: supaErr.message,
      code: supaErr.code,
      details: supaErr.details,
    });

    res.status(500).json({
      success: false,
      message: 'A database error occurred',
      code: 'DATABASE_ERROR',
    });
    return;
  }

  // Unknown / unexpected error
  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    name: err.name,
  });

  res.status(500).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : err.message,
    code: 'INTERNAL_ERROR',
  });
}
