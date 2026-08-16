import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAppState } from '@/hooks/useAppState';
import { useAuthStore } from '../stores/authStore';
import type { ProfileWithRole } from '../services/authService';
import { getRoleRoute } from '@/types/navigation';
import { logger } from '@/utils/logger';

/**
 * Whether the one-time auth bootstrap has already run in this JS context.
 *
 * **Module scope, deliberately — not a `useRef`.** `app/_layout.tsx` renders
 * `null` while `isLoading` is true, and the root layout is itself a route
 * component: returning `null` destroys the `<Stack>`, and with no navigator
 * expo-router tears down and re-creates the root route. `RootLayout` therefore
 * remounts as a *fresh instance* with fresh refs, so a `useRef` guard reset on
 * every remount and let `initialize()` run again — setting `isLoading` true,
 * rendering `null`, and remounting once more. That loop never settled: the app
 * sat on a blank screen with no error, no crash and nothing in the logs but the
 * bootstrap starting over. Observed at 145 remounts in a single session.
 *
 * The bootstrap is a once-per-process concern, so the flag has to outlive the
 * component that triggers it.
 */
let hasBootstrapped = false;

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Subscribes to Supabase auth state changes and keeps the Zustand auth store
 * in sync.
 *
 * - `SIGNED_IN` : fetches profile, stores it, and navigates to the role route.
 * - `SIGNED_OUT`: clears auth store.
 * - On foreground: restarts token auto-refresh and re-checks the session.
 * - On background: stops token auto-refresh.
 *
 * Mount this **once** near the app root (e.g. in the root layout).
 */
export function useSession() {
  const router = useRouter();
  const {
    isLoading,
    isAuthenticated,
    role,
    setSession,
    setProfile,
    setRole,
    initialize,
  } = useAuthStore();


  // ── Bootstrap on mount ───────────────────────────────────────────────
  useEffect(() => {
    if (!hasBootstrapped) {
      hasBootstrapped = true;
      initialize();
    }
  }, [initialize]);

  // ── Auth state listener ──────────────────────────────────────────────
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      switch (event) {
        case 'SIGNED_IN':
        case 'TOKEN_REFRESHED': {
          setSession(session);

          if (session?.user) {
            // Captured now, compared once the fetch returns — see the guard
            // below.
            const userId = session.user.id;

            // Deliberately NOT awaited inside the callback.
            //
            // auth-js emits SIGNED_IN from inside its own `_initialize`, and
            // `_notifyAllSubscribers` awaits whatever the callback returns. An
            // async callback that awaited a network round trip therefore held
            // `initializePromise` open — and `getSession()` waits on that
            // before anything else. `authStore.initialize()` awaits
            // `getSession()` and only then clears `isLoading`, which the root
            // layout renders `null` until. So a profile fetch that hung (hotel
            // wifi, captive portal — supabase-js sets no fetch timeout) pinned
            // the app on a blank splash screen with no error and no way out but
            // a force quit. Detaching the work breaks that chain.
            void (async () => {
              let result: ProfileWithRole | null;
              try {
                // Shared with `initialize()`, which asks for the same profile at
                // the same moment on a cold start.
                result = await useAuthStore.getState().loadProfile(userId);
              } catch {
                // The fetch failed rather than finding nothing. Leave the user
                // where they are — sending them to onboarding here is what made
                // a flaky network look like a brand-new account.
                return;
              }

              // Because this is detached, a sign-out can land while the fetch is
              // still out — and a slow network, the reason for detaching, is
              // precisely when that happens. SIGNED_OUT clears the store and
              // routes to login; the late resolution then wrote the profile back
              // and replaced the route with a role home screen belonging to a
              // user who no longer has a session, so every request from that
              // screen 401'd. Whoever the store points at now wins.
              if (useAuthStore.getState().session?.user?.id !== userId) {
                return;
              }

              if (result) {
                setProfile(result.profile);
                setRole(result.role);
              }

              // Only navigate once a navigator exists. Because of the ordering
              // above, SIGNED_IN on a cold start fires while the root layout is
              // still rendering null, and expo-router throws "Attempted to
              // navigate before mounting the Root Layout component". The
              // initial route is derived by app/index.tsx anyway; this redirect
              // is for a sign-in that happens with the app already running.
              if (event === 'SIGNED_IN' && !useAuthStore.getState().isLoading) {
                router.replace(
                  (result ? getRoleRoute(result.role) : '/(auth)/onboarding') as never,
                );
              }
            })();
          }
          break;
        }

        case 'SIGNED_OUT': {
          setSession(null);
          setProfile(null);
          setRole(null);
          router.replace('/(auth)/login' as never);
          break;
        }

        default:
          break;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [router, setSession, setProfile, setRole]);

  // ── Follow the app between foreground and background ──────────────────
  //
  // auth-js only manages its own refresh ticker on platforms that have
  // `document.visibilityState`. React Native has none, so it takes the "assume
  // always foreground" branch: it starts a bare `setInterval` at init and never
  // stops it. But the OS suspends JS timers for a backgrounded app, so the
  // ticker simply does not run while the app is away — and an access token
  // lives an hour. Reopening the app the next morning therefore restored a
  // session whose token had expired hours ago, and nothing refreshed it until
  // the interval happened to come round again; every request until then got a
  // 401. Supabase's React Native guidance is to drive this from AppState, which
  // is what this does. `startAutoRefresh` also runs one tick immediately, so
  // the token is renewed before the first screen refetches.
  useAppState((state) => {
    if (state !== 'active') {
      // Backgrounded: stop the ticker rather than leave it to fire requests the
      // OS will not let complete.
      supabase.auth.stopAutoRefresh().catch((err) => {
        logger.error('Could not stop Supabase auto-refresh', err);
      });
      return;
    }

    supabase.auth.startAutoRefresh().catch((err) => {
      logger.error('Could not restart Supabase auto-refresh', err);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session && isAuthenticated) {
        // Session expired while backgrounded — sign out and redirect
        useAuthStore.getState().signOut();
        return;
      }
      setSession(session);
    });
  });

  return { isLoading, isAuthenticated, role };
}
