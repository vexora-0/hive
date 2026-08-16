import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OnboardingState {
  /**
   * Whether the intro carousel has been seen **in this run of the app**.
   *
   * Deliberately not persisted — see the note on the store below.
   */
  hasOnboarded: boolean;
}

interface OnboardingActions {
  /** Mark onboarding as seen for the rest of this run. */
  completeOnboarding: () => void;
  /** Put the carousel back. */
  reset: () => void;
}

type OnboardingStore = OnboardingState & OnboardingActions;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

/**
 * Whether the intro carousel has been seen — **for this run only.**
 *
 * ── Why this is not persisted ────────────────────────────────────────
 *
 * It used to be, under the AsyncStorage key `hive-onboarding`, which on web is
 * a `localStorage` entry that survives every reload. That is the conventional
 * behaviour and it made the project's own work harder in a way that mattered
 * more than the convention: **this app is demonstrated by recording it**, and a
 * recording starts at the front door. Once anybody had tapped through the
 * carousel — or hit Skip, which also set the flag — that browser profile could
 * never show it again, and the second take opened on the login screen instead.
 * Getting it back meant remembering an incantation in the devtools console
 * before every attempt.
 *
 * What this costs in the shipped product is close to nothing, and it is worth
 * being precise about why rather than hand-waving it:
 *
 *  - A **signed-in** user never reaches the carousel at all. `app/index.tsx`
 *    checks the session first and sends them to their role's home, on purpose,
 *    because somebody with a session is not a first-time user. That is the
 *    overwhelming majority of real launches.
 *  - A **signed-out** user now sees the carousel again on a cold start. Three
 *    slides they can dismiss with one tap, in front of a login screen they were
 *    going to have to interact with anyway.
 *
 * So the flag only ever changed the experience of somebody who had signed out
 * and come back. That is a small enough cost for a demo that reliably starts
 * where it is supposed to.
 *
 * The store is kept rather than deleted because the carousel still needs to
 * know, within a single run, that it has been dismissed — otherwise
 * `navigateAfterOnboarding` would bounce straight back into it.
 */
export const useOnboardingStore = create<OnboardingStore>()((set) => ({
  hasOnboarded: false,

  completeOnboarding: () => set({ hasOnboarded: true }),

  reset: () => set({ hasOnboarded: false }),
}));
