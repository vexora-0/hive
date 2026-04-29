import 'react-native-get-random-values'; // must be first so crypto.getRandomValues exists for uuid
import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import { Baloo2_700Bold } from '@expo-google-fonts/baloo-2';
import {
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_700Bold,
} from '@expo-google-fonts/nunito';

import { queryClient } from '@/lib/queryClient';
import { ErrorBoundary } from '@/components/feedback';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { useSession } from '@/features/auth/hooks/useSession';

// ---------------------------------------------------------------------------
// Keep the splash screen visible until fonts are loaded and auth is resolved.
// ---------------------------------------------------------------------------

SplashScreen.preventAutoHideAsync();

// ---------------------------------------------------------------------------
// Root Layout
// ---------------------------------------------------------------------------

export default function RootLayout() {
  // ── Fonts ───────────────────────────────────────────────────────────
  const [fontsLoaded, fontError] = useFonts({
    Baloo2_700Bold,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_700Bold,
  });

  // ── Auth ────────────────────────────────────────────────────────────
  const { isLoading: authLoading } = useSession();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role = useAuthStore((s) => s.role);

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
            <Stack screenOptions={{ headerShown: false }}>
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
  },
});
