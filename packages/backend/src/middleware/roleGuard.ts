import { AppError } from './errorHandler';
import { Request, Response, NextFunction } from 'express';

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
 * Verify the caller may act on a given school.
 *
 * Admins are cross-school by design. Everyone else is confined to their own —
 * without this, any teacher could enumerate another school's classes and its
 * complete student roster including dates of birth. (G-08)
 */
export function assertSchoolAccess(
  user: { role: string; schoolId: string | null } | undefined,
  schoolId: string,
): void {
  if (!user) {
    throw new AppError('Authentication required', 401, 'UNAUTHORIZED');
  }
  if (user.role === 'admin') return;
  if (user.schoolId !== schoolId) {
    throw new AppError('You do not have access to this school', 403, 'FORBIDDEN');
  }
}
