import React from 'react';

import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { HeaderBar } from '@/components/navigation/HeaderBar';
import { NotificationCenter } from '@/features/notifications/components/NotificationCenter';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * Admin notifications screen.
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
