import React from 'react';
import { Redirect } from 'expo-router';

import type { UserRole } from '@/types/supabase';
import { getRoleRoute } from '@/types/navigation';
import { useAuthStore } from '../stores/authStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RoleGateProps {
  /** Roles permitted to see `children`. */
  allow: UserRole[];
  children: React.ReactNode;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<RoleGate>` — route-level access control for a navigation group.
 *
 * Wrap a group layout's navigator in this so the group cannot render for a
 * user whose role does not belong there:
 *
 * ```tsx
 * <RoleGate allow={['admin']}>
 *   <Tabs>…</Tabs>
 * </RoleGate>
 * ```
 *
 * `app/index.tsx` redirects by role, but it is only consulted when the user
 * enters through the root. `hive://` is a registered scheme (`app.json`), so
 * `hive://(admin)/dashboard` mounts the admin group directly and never passes
 * through it.
 *
 * **This is a UX control, not a security control.** It stops the wrong screen
 * from rendering; it does not stop anyone reading data. The API enforces the
 * same rules server-side in `roleGuard` and the service layer, and RLS covers
 * the screens that query Supabase directly. Those two are the real boundary —
 * a client check is trivially bypassed by anyone running a modified build.
 */
export function RoleGate({ allow, children }: RoleGateProps) {
  const isLoading = useAuthStore((s) => s.isLoading);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);

  // Auth is still resolving — the splash screen is up, so render nothing
  // rather than flashing a screen we may be about to redirect away from.
  if (isLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // Authenticated but the profile fetch failed, so we cannot tell what they
  // are allowed to see. Treat an unknown role as no access.
  if (!role) {
    return <Redirect href="/(auth)/login" />;
  }

  // Signed in as the wrong role for this group. Send them to their own home,
  // not to login: this is a misrouting, not an authentication failure, and
  // bouncing a signed-in user to a login screen reads as a bug.
  if (!allow.includes(role)) {
    return <Redirect href={getRoleRoute(role) as never} />;
  }

  return <>{children}</>;
}

export default RoleGate;
