import React from 'react';

import { ProfileScreen } from '@/features/auth/components/ProfileScreen';

/**
 * Admin Profile screen — last tab in the admin tab bar.
 *
 * The teacher, parent and admin profile screens were three near-identical
 * copies; they now share one implementation.
 */
export default function AdminProfileScreen() {
  return <ProfileScreen />;
}
