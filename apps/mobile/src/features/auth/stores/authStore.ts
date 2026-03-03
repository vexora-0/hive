import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { Tables, UserRole } from '@/types/supabase';
import { supabase } from '@/lib/supabase';

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
    await supabase.auth.signOut();
    set({
      session: null,
      user: null,
      profile: null,
      role: null,
      isAuthenticated: false,
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
