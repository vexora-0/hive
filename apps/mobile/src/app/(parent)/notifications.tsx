import React from 'react';

import { ScreenContainer } from '@/components/layout';
import { HeaderBar } from '@/components/navigation';
import { NotificationCenter } from '@/features/notifications/components/NotificationCenter';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * Notifications screen.
 *
 * `NotificationCenter` is role-agnostic — the API returns whatever
 * notifications belong to the authenticated user, so the same component serves
 * all three roles.
 */
export default function NotificationsScreen() {
  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <HeaderBar large title="Notifications" />
      <NotificationCenter />
    </ScreenContainer>
  );
}
