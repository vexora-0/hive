import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';
import { AppError } from '../middleware/errorHandler';

interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

interface PaginatedNotifications {
  notifications: Notification[];
  nextCursor: string | null;
}

export async function getNotifications(
  userId: string,
  cursor?: string,
  limit: number = 20,
): Promise<PaginatedNotifications> {
  // Order: unread first, then by created_at desc
  let query = supabaseAdmin
    .from('notifications')
    .select('id, user_id, type, title, body, data, is_read, created_at')
    .eq('user_id', userId)
    .order('is_read', { ascending: true })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString());
      query = query.or(
        `and(is_read.eq.${decoded.is_read},created_at.lt.${decoded.createdAt}),` +
        `and(is_read.eq.${decoded.is_read},created_at.eq.${decoded.createdAt},id.lt.${decoded.id}),` +
        `is_read.gt.${decoded.is_read}`,
      );
    } catch {
      throw new AppError('Invalid cursor', 400, 'INVALID_CURSOR');
    }
  }

  const { data: notifications, error } = await query;

  if (error) {
    logger.error('Failed to fetch notifications', {
      error: error.message,
      userId,
    });
    throw new AppError('Failed to fetch notifications', 500, 'QUERY_FAILED');
  }

  const hasNext = (notifications?.length ?? 0) > limit;
  const results = (notifications?.slice(0, limit) ?? []) as Notification[];

  const nextCursor =
    hasNext && results.length > 0
      ? Buffer.from(
          JSON.stringify({
            is_read: results[results.length - 1].is_read,
            createdAt: results[results.length - 1].created_at,
            id: results[results.length - 1].id,
          }),
        ).toString('base64url')
      : null;

  return { notifications: results, nextCursor };
}

export async function markAsRead(
  notificationId: string,
  userId: string,
): Promise<void> {
  const { error, count } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true }, { count: 'exact' })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    logger.error('Failed to mark notification as read', {
      error: error.message,
      notificationId,
      userId,
    });
    throw new AppError(
      'Failed to mark notification as read',
      500,
      'UPDATE_FAILED',
    );
  }

  if (count === 0) {
    throw new AppError('Notification not found', 404, 'NOT_FOUND');
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    logger.error('Failed to get unread count', {
      error: error.message,
      userId,
    });
    throw new AppError('Failed to get unread count', 500, 'QUERY_FAILED');
  }

  return count ?? 0;
}

export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
): Promise<Notification> {
  const notification = {
    id: uuidv4(),
    user_id: userId,
    type,
    title,
    body,
    data: data ?? null,
    is_read: false,
  };

  const { data: created, error } = await supabaseAdmin
    .from('notifications')
    .insert(notification)
    .select()
    .single();

  if (error) {
    logger.error('Failed to create notification', {
      error: error.message,
      userId,
      type,
    });
    throw new AppError(
      'Failed to create notification',
      500,
      'INSERT_FAILED',
    );
  }

  logger.info('Notification created', {
    notificationId: notification.id,
    userId,
    type,
  });

  return created as Notification;
}
