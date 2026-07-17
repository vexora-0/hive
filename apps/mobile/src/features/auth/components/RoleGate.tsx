import React from 'react';
import { Redirect } from 'expo-router';

import { useAuthStore } from '../stores/authStore';
import { getRoleRoute } from '@/types/navigation';
import type { UserRole } from '@/types/supabase';

export interface RoleGateProps {
  /** Roles permitted to see the wrapped screens. */
  allow: UserRole[];
  children: React.ReactNode;
}

/**
 * Route-level access control.
 *
 * Nothing guarded navigation before this: every role group rendered
 * unconditionally, so a parent deep-linking `hive://(admin)/dashboard` got the
 * full admin interface. The API refused the requests, so no data leaked — but
 * the screens rendered, which reads as broken and unsafe.
 *
 * This is a UX control, not a security boundary. The server is the only thing
 * that actually enforces access; this stops the app showing a surface the user
 * has no business seeing.
 */
export function RoleGate({ allow, children }: RoleGateProps) {
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);

  // Splash is still up — rendering here causes a visible flash of the wrong
  // screen before the redirect resolves.
  if (isLoading) return null;

  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  // Authenticated but the profile never resolved: the trigger may not have run.
  if (!role) return <Redirect href="/(auth)/login" />;

  // Wrong role is not an auth failure — send them to their own home rather
  // than back to login.
  if (!allow.includes(role)) {
    return <Redirect href={getRoleRoute(role) as never} />;
  }

  return <>{children}</>;
}

export default RoleGate;
