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
 *   1. Not onboarded  -> onboarding flow
 *   2. Not signed in  -> login screen
 *   3. Signed in      -> role-based home screen
 */
export default function IndexRedirect() {
  const hasOnboarded = useOnboardingStore((s) => s.hasOnboarded);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);

  // 1. First-time user: show onboarding
  if (!hasOnboarded) {
    return <Redirect href="/(auth)/onboarding" />;
  }

  // 2. Returning user, not signed in: show login
  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  // 3. Authenticated: route based on role
  if (role) {
    const route = getRoleRoute(role);
    return <Redirect href={route as never} />;
  }

  // Fallback: if role hasn't resolved yet, go to login
  return <Redirect href="/(auth)/login" />;
}
