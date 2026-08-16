import React from 'react';
import { Redirect } from 'expo-router';

import { useOnboardingStore } from '@/features/onboarding/stores/onboardingStore';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { getRoleRoute } from '@/types/navigation';

// ---------------------------------------------------------------------------
// Entry Redirect
// ---------------------------------------------------------------------------

/**
 * Root index route.
 *
 * Determines where to send the user based on their current state:
 *   1. Signed in      -> role-based home screen
 *   2. Not onboarded  -> onboarding flow
 *   3. Not signed in  -> login screen
 */
export default function IndexRedirect() {
  const hasOnboarded = useOnboardingStore((s) => s.hasOnboarded);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);

  // There is nothing to wait for here any more.
  //
  // This used to hold on a `hasHydrated` flag and paint the app mark while
  // `hasOnboarded` was read back from AsyncStorage — a genuinely necessary
  // wait, because the flag defaults to `false` and deciding before the read
  // landed would drop a returning user into the carousel and then overwrite
  // their stored value. The flag is no longer persisted (see the store), so
  // there is no read, no race and no hold. Auth is already resolved before
  // this renders: `_layout.tsx` holds the splash until `useSession` settles.

  // 1. Signed in: straight to their home, checked before the onboarding flag on
  //    purpose. Someone with a session is not a first-time user whatever that
  //    flag says. **This is what still skips the carousel between takes when a
  //    recording left a session behind** — sign out, or clear site data, to get
  //    a true first run.
  if (isAuthenticated && role) {
    const route = getRoleRoute(role);
    return <Redirect href={route as never} />;
  }

  // 2. Not seen the carousel yet **this run**: show it. Since the flag is no
  //    longer persisted, that means every cold start by a signed-out user —
  //    which is exactly what recording a demo needs.
  if (!hasOnboarded) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  // 3. Not signed in — or signed in with a role that has not resolved yet, in
  //    which case the login screen fetches the profile and forwards them on.
  return <Redirect href="/(auth)/login" />;
}
