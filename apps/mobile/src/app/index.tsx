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
  const hasHydrated = useOnboardingStore((s) => s.hasHydrated);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);

  // `hasOnboarded` is read back from AsyncStorage asynchronously and is `false`
  // until it lands. Redirecting before then could not distinguish "has never
  // onboarded" from "we have not looked yet", so whenever the read lost the
  // race a returning user was dropped into the intro carousel — and once they
  // tapped through it, `completeOnboarding` overwrote whatever was in storage.
  // The splash screen is gated on auth, not on this, so wait here instead.
  if (!hasHydrated) {
    return null;
  }

  // 1. Signed in: straight to their home, checked before the onboarding flag on
  //    purpose. Someone with a session is not a first-time user whatever that
  //    flag says — and if the AsyncStorage read failed it says `false`.
  if (isAuthenticated && role) {
    const route = getRoleRoute(role);
    return <Redirect href={route as never} />;
  }

  // 2. First-time user: show onboarding
  if (!hasOnboarded) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  // 3. Not signed in — or signed in with a role that has not resolved yet, in
  //    which case the login screen fetches the profile and forwards them on.
  return <Redirect href="/(auth)/login" />;
}
