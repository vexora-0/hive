import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';

export interface AuthUser {
  id: string;
  email: string;
  role: string;
  schoolId: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        message: 'Missing or invalid Authorization header',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    const token = authHeader.substring(7);

    const {
      data: { user },
      error,
    } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      // Deliberately no req.ip. A client IP is personal data under GDPR, and
      // this line fires on every expired token — which is routine, not an
      // attack — so it would accumulate a log of who used the app and from
      // where, for no diagnostic benefit.
      logger.warn('Invalid auth token', {
        error: error?.message,
      });
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        code: 'UNAUTHORIZED',
      });
      return;
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role, school_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      logger.error('Profile not found for authenticated user', {
        userId: user.id,
        error: profileError?.message,
      });
      res.status(401).json({
        success: false,
        message: 'User profile not found',
        code: 'PROFILE_NOT_FOUND',
      });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email ?? '',
      role: profile.role,
      schoolId: profile.school_id,
    };

    next();
  } catch (err) {
    // The message only. Logging the error object serialises whatever the
    // thrower attached to it — for a fetch failure inside the Supabase client
    // that can include the request, and the request carries the bearer token.
    logger.error('Authentication error', {
      error: err instanceof Error ? err.message : String(err),
    });
    res.status(500).json({
      success: false,
      message: 'Internal authentication error',
      code: 'AUTH_ERROR',
    });
  }
}
