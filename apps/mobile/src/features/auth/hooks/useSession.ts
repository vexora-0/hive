import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useOnForeground } from '@/hooks/useAppState';
import { useAuthStore } from '../stores/authStore';
import { fetchUserProfile } from '../services/authService';
import { getRoleRoute } from '@/types/navigation';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Subscribes to Supabase auth state changes and keeps the Zustand auth store
 * in sync.
 *
 * - `SIGNED_IN` : fetches profile, stores it, and navigates to the role route.
 * - `SIGNED_OUT`: clears auth store.
 * - On foreground: refreshes the session silently.
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

  // Track whether we've already run the initial bootstrap.
  const initializedRef = useRef(false);

  // ── Bootstrap on mount ───────────────────────────────────────────────
  useEffect(() => {
    if (!initializedRef.current) {
      initializedRef.current = true;
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
              let result: Awaited<ReturnType<typeof fetchUserProfile>>;
              try {
                result = await fetchUserProfile(session.user.id);
              } catch {
                // The fetch failed rather than finding nothing. Leave the user
                // where they are — sending them to onboarding here is what made
                // a flaky network look like a brand-new account.
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

  // ── Refresh session when app returns to foreground ────────────────────
  useOnForeground(() => {
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
