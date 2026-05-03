import React from 'react';

import { ScreenContainer } from '@/components/layout';
import { HeaderBar } from '@/components/navigation';
import { NotificationCenter } from '@/features/notifications/components/NotificationCenter';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * Teacher notifications screen.
 *
 * Renders the shared `<NotificationCenter />`, which handles its own loading,
 * empty and pagination states.
 */
export default function NotificationsScreen() {
  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <HeaderBar title="Notifications" />
      <NotificationCenter />
    </ScreenContainer>
  );
}
