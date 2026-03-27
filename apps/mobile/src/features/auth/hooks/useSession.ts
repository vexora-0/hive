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
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      switch (event) {
        case 'SIGNED_IN':
        case 'TOKEN_REFRESHED': {
          setSession(session);

          if (session?.user) {
            const result = await fetchUserProfile(session.user.id);
            if (result) {
              setProfile(result.profile);
              setRole(result.role);

              // Navigate to the appropriate role-based route
              if (event === 'SIGNED_IN') {
                const route = getRoleRoute(result.role);
                router.replace(route as never);
              }
            } else {
              // Profile doesn't exist yet — send to onboarding
              if (event === 'SIGNED_IN') {
                router.replace('/(auth)/onboarding' as never);
              }
            }
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
