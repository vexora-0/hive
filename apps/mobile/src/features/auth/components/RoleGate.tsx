import React from 'react';
import { Redirect, useGlobalSearchParams, useSegments } from 'expo-router';

import { useAuthStore } from '../stores/authStore';
import { getRoleEquivalentRoute, getRoleRoute } from '@/types/navigation';
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
  const segments = useSegments();
  // Carried across the redirect below. `/orders?photoId=…` is how the photo
  // screen opens the order sheet, so dropping the query would land the parent
  // on their order history with no sheet — a deep link that half worked.
  const params = useGlobalSearchParams();

  // Splash is still up — rendering here causes a visible flash of the wrong
  // screen before the redirect resolves.
  if (isLoading) return null;

  if (!isAuthenticated) return <Redirect href="/(auth)/login" />;

  // Authenticated but the profile never resolved: the trigger may not have run.
  if (!role) return <Redirect href="/(auth)/login" />;

  // Wrong role is not an auth failure — send them to their own home rather
  // than back to login.
  //
  // Except when the screen they asked for also exists in their own group: a
  // cold page load of `/orders` resolves to `(admin)/orders`, because a group
  // is not part of the URL and `(admin)` sorts first, so a parent deep-linking
  // their own order history arrived here and was dropped on the feed. Send
  // them to their group's copy of the same screen instead of home.
  if (!allow.includes(role)) {
    const equivalent = getRoleEquivalentRoute(role, segments);
    if (equivalent) {
      return <Redirect href={{ pathname: equivalent, params } as never} />;
    }
    return <Redirect href={getRoleRoute(role) as never} />;
  }

  return <>{children}</>;
}

export default RoleGate;
