import React from 'react';

import { ScreenContainer } from '@/components/layout';
import { HeaderBar } from '@/components/navigation';
import { EmptyState } from '@/components/feedback';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * Parent notifications screen — coming soon placeholder.
 */
export default function NotificationsScreen() {
  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <HeaderBar title="Notifications" />
      <EmptyState
        title="Coming Soon"
        message="Notifications are coming soon. Stay tuned!"
      />
    </ScreenContainer>
  );
}
