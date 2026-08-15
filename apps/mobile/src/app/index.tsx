import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';

import { colors } from '@/theme';
import { HiveMark } from '@/components/brand';
import { Reveal } from '@/components/animation';
import { useOnboardingStore } from '@/features/onboarding/stores/onboardingStore';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { getRoleRoute } from '@/types/navigation';

// ---------------------------------------------------------------------------
// The hold
// ---------------------------------------------------------------------------

/**
 * What the app shows while it works out where to send you.
 *
 * This used to be `return null`, which renders a bare cream rectangle. The
 * native splash is dismissed on *auth* resolving, not on the onboarding flag
 * landing, so on a cold start where the AsyncStorage read is the slower of the
 * two the splash lifted onto an empty page and the app looked, for a beat, like
 * it had failed to start.
 *
 * The mark arrives through `<Reveal>` rather than being painted straight on,
 * and that is the whole trick: the fade runs over `duration.slow`, so a read
 * that resolves in 30ms unmounts this while the mark is still at a few per cent
 * opacity and nobody sees anything at all. Only a genuinely slow read ever
 * shows a logo — which is the same judgment `SkeletonShimmer` makes about
 * placeholders, applied to the app's front door.
 *
 * No spinner. A spinner on a storage read that normally takes one frame is the
 * app apologising for something it has not done.
 */
function HydrationHold() {
  return (
    <View style={styles.hold}>
      <Reveal scale>
        <HiveMark size={56} />
      </Reveal>
    </View>
  );
}

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
    return <HydrationHold />;
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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  hold: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.cream,
  },
});
