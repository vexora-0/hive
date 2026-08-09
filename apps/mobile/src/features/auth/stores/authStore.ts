import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { Tables, UserRole } from '@/types/supabase';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';

// ---------------------------------------------------------------------------
// Sign-out cleanup
// ---------------------------------------------------------------------------

/**
 * Things that must be discarded when the user signs out.
 *
 * A registry rather than direct imports: the query client and the cart store
 * both sit above this module, and importing them here would form a cycle.
 * Registered once at app start — see `_layout.tsx`.
 */
const onSignedOut = new Set<() => void>();

/** Register a callback to run on sign-out. Returns an unsubscribe function. */
export function registerSignOutCleanup(fn: () => void): () => void {
  onSignedOut.add(fn);
  return () => onSignedOut.delete(fn);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthStoreState {
  session: Session | null;
  user: User | null;
  profile: Tables<'profiles'> | null;
  role: UserRole | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthStoreActions {
  /** Replace session & user, recompute `isAuthenticated`. */
  setSession: (session: Session | null) => void;
  /** Store the fetched profile row. */
  setProfile: (profile: Tables<'profiles'> | null) => void;
  /** Override the resolved user role. */
  setRole: (role: UserRole | null) => void;
  /** Sign the user out of Supabase and reset all local auth state. */
  signOut: () => Promise<void>;
  /** Bootstrap: check for an existing session and hydrate profile / role. */
  initialize: () => Promise<void>;
}

type AuthStore = AuthStoreState & AuthStoreActions;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthStore>((set, get) => ({
  // ── State ────────────────────────────────────────────────────────────
  session: null,
  user: null,
  profile: null,
  role: null,
  isLoading: true,
  isAuthenticated: false,

  // ── Actions ──────────────────────────────────────────────────────────

  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      isAuthenticated: session !== null,
    }),

  setProfile: (profile) =>
    set({
      profile,
      role: profile?.role ?? null,
    }),

  setRole: (role) => set({ role }),

  signOut: async () => {
    // auth-js returns early — before clearing the stored session — when the
    // revoke request fails with anything other than a 401/403/404, which
    // includes every network error. The previous code ignored that result, so
    // the UI said "signed out" while the session JSON stayed in SecureStore and
    // the next cold start silently signed the same user back in. On a shared
    // preschool tablet that is the wrong way to fail.
    const { error } = await supabase.auth.signOut();

    if (error) {
      logger.error('Sign-out failed on the server; clearing local session anyway', error);
      // `scope: 'local'` skips the network call entirely and only wipes the
      // stored session, which is the part that actually matters here.
      await supabase.auth.signOut({ scope: 'local' }).catch(() => {
        // Nothing further to try. The in-memory state is cleared below either
        // way, so the user is signed out of this running app.
      });
    }

    set({
      session: null,
      user: null,
      profile: null,
      role: null,
      isAuthenticated: false,
    });

    // Everything cached under the previous identity has to go with them.
    // Without this, signing in as a second parent on the same device served
    // the first parent's feed, notifications and orders from cache on first
    // paint, and their pending print order survived in the cart.
    onSignedOut.forEach((fn) => {
      try {
        fn();
      } catch (err) {
        logger.error('Sign-out cleanup handler failed', err);
      }
    });
  },

  initialize: async () => {
    try {
      set({ isLoading: true });

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        set({ isLoading: false, isAuthenticated: false });
        return;
      }

      set({
        session,
        user: session.user,
        isAuthenticated: true,
      });

      // Fetch the user's profile and role
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        set({
          profile,
          role: profile.role,
        });
      }
    } catch {
      // If hydration fails we leave the user signed out
      set({
        session: null,
        user: null,
        profile: null,
        role: null,
        isAuthenticated: false,
      });
    } finally {
      set({ isLoading: false });
    }
  },
}));
