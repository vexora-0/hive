import 'react-native-get-random-values'; // must be first so crypto.getRandomValues exists for uuid
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  Fraunces_300Light,
  Fraunces_400Regular_Italic,
  Fraunces_600SemiBold,
  Fraunces_700Bold,
} from '@expo-google-fonts/fraunces';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';

import { colors } from '@/theme';
import { queryClient } from '@/lib/queryClient';
import { ErrorBoundary, ToastProvider } from '@/components/feedback';
import { useSession } from '@/features/auth/hooks/useSession';
import { registerSignOutCleanup } from '@/features/auth/stores/authStore';
import { useCartStore } from '@/features/orders/stores/cartStore';
import { initSentry, Sentry } from '@/lib/sentry';

// ---------------------------------------------------------------------------
// Error reporting — before the tree mounts, so start-up crashes are captured.
// No-op unless EXPO_PUBLIC_SENTRY_DSN is set.
// ---------------------------------------------------------------------------

initSentry();

// ---------------------------------------------------------------------------
// Keep the splash screen visible until fonts are loaded and auth is resolved.
// ---------------------------------------------------------------------------

SplashScreen.preventAutoHideAsync();

// ---------------------------------------------------------------------------
// Root Layout
// ---------------------------------------------------------------------------

function RootLayout() {
  // ── Fonts ───────────────────────────────────────────────────────────
  // Fraunces carries the three display sizes; Plus Jakarta Sans does
  // everything else. See src/theme/typography.ts for which weight does what.
  const [fontsLoaded, fontError] = useFonts({
    // Light is the airy hero cut and italic is the one editorial line a screen
    // is allowed. Both ship inside the already-pinned @expo-google-fonts
    // package, so neither is a dependency change.
    Fraunces_300Light,
    Fraunces_400Regular_Italic,
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  // ── Auth ────────────────────────────────────────────────────────────
  // Only the loading flag is needed here — it gates the splash screen. Which
  // group a user may enter is decided by <RoleGate> inside each group layout,
  // so that deep links are covered too.
  const { isLoading: authLoading } = useSession();

  // ── Discard per-user state on sign-out ──────────────────────────────
  // Registered here because this is the one place guaranteed to have mounted
  // before any sign-out can happen. Without it, signing in as a second parent
  // on the same device showed the first parent's feed, notifications and
  // orders from cache on first paint, and inherited their pending print order.
  useEffect(() => {
    const unregister = registerSignOutCleanup(() => {
      queryClient.clear();
      useCartStore.getState().clearCart();
    });
    return unregister;
  }, []);

  // ── Hide splash when ready ─────────────────────────────────────────
  const isReady = (fontsLoaded || !!fontError) && !authLoading;

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  // Don't render until fonts + auth are resolved.
  if (!isReady) {
    return null;
  }

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ErrorBoundary>
            <ToastProvider>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  // Without this every push flashes the default white before
                  // the screen paints, which on a cream ground reads as a
                  // stutter.
                  contentStyle: { backgroundColor: colors.background.cream },
                }}
              >
                {/* Auth group — shown when not authenticated */}
                <Stack.Screen
                  name="(auth)"
                  options={{ headerShown: false }}
                />

                {/* Role-based groups — shown when authenticated */}
                <Stack.Screen
                  name="(teacher)"
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="(parent)"
                  options={{ headerShown: false }}
                />
                <Stack.Screen
                  name="(admin)"
                  options={{ headerShown: false }}
                />

                {/* Catch-all index redirect */}
                <Stack.Screen
                  name="index"
                  options={{ headerShown: false }}
                />

                {/* 404 */}
                <Stack.Screen
                  name="+not-found"
                  options={{ headerShown: false }}
                />
              </Stack>
            </ToastProvider>
          </ErrorBoundary>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background.cream,
  },
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

/**
 * Wrapped so that React render errors escaping <ErrorBoundary> — and errors in
 * the boundary itself — still reach Sentry. Without a DSN, Sentry.wrap is a
 * pass-through.
 */
export default Sentry.wrap(RootLayout);
