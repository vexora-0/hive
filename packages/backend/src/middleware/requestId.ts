import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Attach a correlation ID to every request.
 *
 * `X-Request-ID` was already allow-listed in the CORS configuration but was
 * never generated, read or logged, so a user reporting "it failed" gave us
 * nothing to grep for. Honours an inbound ID when a proxy or client supplies
 * one, otherwise generates a UUID, and always echoes it back.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const inbound = req.headers['x-request-id'];
  const id =
    typeof inbound === 'string' && inbound.length > 0 && inbound.length <= 128
      ? inbound
      : randomUUID();

  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}
