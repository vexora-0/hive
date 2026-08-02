import React from 'react';

import { ProfileScreen } from '@/features/auth/components/ProfileScreen';

/**
 * Teacher Profile screen — fourth tab in the teacher tab bar
 * (Dashboard, Upload, Alerts, Profile).
 *
 * The teacher, parent and admin profile screens were three near-identical
 * copies; they now share one implementation.
 */
export default function TeacherProfileScreen() {
  return <ProfileScreen />;
}
