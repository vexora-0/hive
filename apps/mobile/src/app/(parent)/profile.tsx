import React from 'react';

import { ProfileScreen } from '@/features/auth/components/ProfileScreen';

/**
 * Parent Profile screen — fourth tab in the parent tab bar
 * (Feed, Orders, Alerts, Profile).
 *
 * The teacher, parent and admin profile screens were three near-identical
 * copies; they now share one implementation.
 */
export default function ParentProfileScreen() {
  return <ProfileScreen />;
}
