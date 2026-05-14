import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

export function roleGuard(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Authentication required',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${allowedRoles.join(' or ')}`,
        code: 'FORBIDDEN',
      });
      return;
    }

    next();
  };
}

/**
 * Assert that the caller may act on `schoolId`.
 *
 * `roleGuard` answers "what kind of user is this?"; this answers "is this
 * *their* school?". Route handlers that take a school ID from the URL need
 * both — the role check alone lets any teacher enumerate any other school.
 *
 * Platform admins are allowed through for any school: they legitimately need
 * cross-school access, and their `school_id` is null, so a plain equality
 * check would lock them out of everything.
 *
 * Throws rather than writing a response, so callers can `next(err)` and let
 * `errorHandler` render it in the standard envelope.
 */
export function assertSchoolAccess(req: Request, schoolId: string): void {
  if (!req.user) {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }

  if (req.user.role === 'admin') {
    return;
  }

  if (req.user.schoolId !== schoolId) {
    throw new AppError(
      'You do not have access to this school',
      403,
      'FORBIDDEN',
    );
  }
}
