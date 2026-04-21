import { apiRequest } from '@/lib/api';
import type { Tables, NotificationType } from '@/types/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Notification = Tables<'notifications'>;

export interface NotificationsPage {
  notifications: Notification[];
  nextCursor: string | null;
}

export interface UnreadCountResponse {
  count: number;
}

// ---------------------------------------------------------------------------
// Default pagination limit
// ---------------------------------------------------------------------------

const DEFAULT_LIMIT = 20;

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Fetch a paginated list of notifications for the authenticated user.
 *
 * Uses cursor-based pagination — pass the `nextCursor` value from the
 * previous page as `cursor` to fetch the next batch.
 */
export async function getNotifications(
  cursor?: string,
  limit: number = DEFAULT_LIMIT,
): Promise<NotificationsPage> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', String(limit));

  const endpoint = `/notifications?${params.toString()}`;
  const res = await apiRequest<{ success: true; data: Notification[]; cursor: string | null }>(endpoint);
  return { notifications: res.data, nextCursor: res.cursor };
}

/**
 * Mark a single notification as read.
 */
export async function markAsRead(notificationId: string): Promise<void> {
  await apiRequest(`/notifications/${notificationId}/read`, {
    method: 'PATCH',
  });
}

/**
 * Get the total number of unread notifications for the authenticated user.
 */
export async function getUnreadCount(): Promise<UnreadCountResponse> {
  const res = await apiRequest<{ success: true; data: UnreadCountResponse }>('/notifications/unread-count');
  return res.data;
}
