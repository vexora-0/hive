import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';
import { AppError } from '../middleware/errorHandler';
import { decodeCursor, encodeCursor } from '../utils/cursor';

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
  // Newest first, id as tiebreak — deliberately NOT unread-first.
  //
  // Sorting on `is_read` made the sort key a value the user could change by
  // looking at the list. Tapping a row marked it read, the mutation's
  // `onSettled` invalidation refetched, and the row re-sorted to the bottom —
  // out from under the finger that had just tapped it, with the next row
  // sliding up into the tap target. Ordering on `created_at`, which no user
  // action alters, holds the list still for as long as it is on screen.
  //
  // Unread rows are not lost in the crowd: NotificationCard already gives them
  // a dot and a bold title, and the badge count is its own query. In practice
  // the unread ones are the recent ones, so they sort to the top anyway.
  let query = supabaseAdmin
    .from('notifications')
    .select('id, user_id, type, title, body, data, is_read, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    const decoded = decodeCursor(cursor);
    query = query.or(
      `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
    );
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

  const last = results.length > 0 ? results[results.length - 1] : null;
  const nextCursor =
    hasNext && last ? encodeCursor(last.created_at, last.id) : null;

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

/**
 * Mark every unread notification belonging to `userId` as read.
 *
 * Returns how many rows changed, so the caller can reconcile its badge without
 * a second round trip.
 */
export async function markAllAsRead(userId: string): Promise<number> {
  // `.eq('user_id', …)` is the authorization check, not a filter. Every service
  // here uses `supabaseAdmin`, which holds the service-role key and is exempt
  // from RLS, so an UPDATE without it would clear the notifications of every
  // parent and teacher in every school. There is no resource id to check
  // ownership of on this route — the scope IS the check.
  //
  // `.eq('is_read', false)` keeps the returned count honest (rows that changed,
  // not rows that matched) and avoids rewriting a backlog that is already read.
  const { error, count } = await supabaseAdmin
    .from('notifications')
    .update({ is_read: true }, { count: 'exact' })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    logger.error('Failed to mark all notifications as read', {
      error: error.message,
      userId,
    });
    throw new AppError(
      'Failed to mark all notifications as read',
      500,
      'UPDATE_FAILED',
    );
  }

  // Nothing unread is a successful no-op, not a 404: the user asked for an
  // empty inbox and the inbox is empty.
  return count ?? 0;
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
    // `{}`, not null: the column is `jsonb NOT NULL DEFAULT '{}'`, so an
    // explicit null is a constraint violation. Every current caller passes
    // something, which is the only reason this has not fired.
    data: data ?? {},
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
