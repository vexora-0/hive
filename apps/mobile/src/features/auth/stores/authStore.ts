import { create } from 'zustand';
import type { Session, User } from '@supabase/supabase-js';
import type { Tables, UserRole } from '@/types/supabase';
import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { fetchUserProfile, type ProfileWithRole } from '../services/authService';

// ---------------------------------------------------------------------------
// Bootstrap timeouts
// ---------------------------------------------------------------------------

/**
 * How long bootstrap will wait on any single network step before giving up on
 * it and letting the app render.
 *
 * The root layout renders `null` while `isLoading` is true, and supabase-js
 * sets no fetch timeout on its requests, so an unanswered read — hotel wifi, a
 * captive portal, a dropped connection — held `isLoading` true for as long as
 * the socket stayed open and left the user on a blank splash screen with no
 * error and no way out but a force quit. Every await in `initialize` is capped
 * so that state cannot be reached.
 */
const BOOTSTRAP_TIMEOUT_MS = 8000;

/** Distinguishes "we stopped waiting" from a legitimate `null` result. */
const TIMED_OUT = Symbol('timed-out');

function withTimeout<T>(
  work: Promise<T>,
  ms: number,
): Promise<T | typeof TIMED_OUT> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(TIMED_OUT), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      },
    );
  });
}

/**
 * Profile reads currently in flight, keyed by user id.
 *
 * A cold start asks for the same profile twice — once from `initialize()`, once
 * from the detached fetch in the `SIGNED_IN` listener — and both land within
 * milliseconds of each other. Sharing the promise makes that one round trip.
 * Entries are dropped as soon as they settle, so this never serves a stale
 * profile; it only collapses concurrent callers.
 */
const profileRequests = new Map<string, Promise<ProfileWithRole | null>>();

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
  /**
   * Fetch the profile for `userId`, sharing the request with any identical one
   * already in flight. Resolves `null` when no profile row exists yet; rejects
   * when the read fails — the two mean different things.
   */
  loadProfile: (userId: string) => Promise<ProfileWithRole | null>;
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

  loadProfile: (userId) => {
    const pending = profileRequests.get(userId);
    if (pending) return pending;

    const request = fetchUserProfile(userId).finally(() => {
      profileRequests.delete(userId);
    });
    profileRequests.set(userId, request);
    return request;
  },

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

      const restored = await withTimeout(
        supabase.auth.getSession().then(({ data }) => data.session),
        BOOTSTRAP_TIMEOUT_MS,
      );

      if (restored === TIMED_OUT) {
        // `getSession()` waits on auth-js's own initialisation, which can
        // include a token refresh over the network. Stop waiting and let the
        // app render: `isAuthenticated` is still false, so the user lands on
        // login, and if the session does turn up later the auth state listener
        // picks it up. Leave the stored state untouched — we learned nothing
        // about it, so asserting "signed out" here would be a guess.
        logger.warn('Timed out restoring the session; continuing to login');
        return;
      }

      if (!restored) {
        set({ isAuthenticated: false });
        return;
      }

      set({
        session: restored,
        user: restored.user,
        isAuthenticated: true,
      });

      // Fetch the user's profile and role. Capped separately: the session is
      // already restored by this point, and a profile that never arrives must
      // not cost the user the splash screen. `app/index.tsx` sends a session
      // with an unresolved role to login, which fetches it again.
      let profile: ProfileWithRole | null | typeof TIMED_OUT;
      try {
        profile = await withTimeout(
          get().loadProfile(restored.user.id),
          BOOTSTRAP_TIMEOUT_MS,
        );
      } catch (err) {
        // A failed read is not "this account has no profile", and it is not a
        // reason to discard a session that Supabase just handed us. Render, and
        // let the next screen retry.
        logger.error('Could not load the profile during bootstrap', err);
        return;
      }

      if (profile === TIMED_OUT) {
        logger.warn('Timed out loading the profile; continuing without a role');
        return;
      }

      if (profile) {
        set({
          profile: profile.profile,
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
