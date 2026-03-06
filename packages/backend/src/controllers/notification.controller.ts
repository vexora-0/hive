import { Request, Response, NextFunction } from 'express';
import * as notificationService from '../services/notification.service';
import { success, paginated } from '../utils/apiResponse';

export async function getNotifications(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { cursor, limit } = req.query as {
      cursor?: string;
      limit?: string;
    };

    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const clampedLimit = Math.min(Math.max(parsedLimit || 20, 1), 50);

    const result = await notificationService.getNotifications(
      userId,
      cursor,
      clampedLimit,
    );

    res.json(paginated(result.notifications, result.nextCursor));
  } catch (err) {
    next(err);
  }
}

export async function markAsRead(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    await notificationService.markAsRead(id, userId);

    res.json(success(null, 'Notification marked as read'));
  } catch (err) {
    next(err);
  }
}

export async function getUnreadCount(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;

    const count = await notificationService.getUnreadCount(userId);

    res.json(success({ count }));
  } catch (err) {
    next(err);
  }
}
