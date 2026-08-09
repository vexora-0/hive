import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { logger } from '@/utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OnboardingState {
  /** Whether the user has completed the onboarding flow. */
  hasOnboarded: boolean;
  /**
   * Whether the persisted value has been read back from AsyncStorage yet.
   *
   * Not persisted — it describes this run of the app. Readers must wait for it
   * before acting on `hasOnboarded`: the read is asynchronous and the flag
   * defaults to `false`, so anything that decides early cannot tell a
   * first-time user from a returning one whose value has not landed.
   */
  hasHydrated: boolean;
}

interface OnboardingActions {
  /** Mark onboarding as complete. Persisted to AsyncStorage. */
  completeOnboarding: () => void;
  /** Reset onboarding state (e.g. for testing or sign-out). */
  reset: () => void;
}

type OnboardingStore = OnboardingState & OnboardingActions;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
      hasOnboarded: false,
      hasHydrated: false,

      completeOnboarding: () => set({ hasOnboarded: true }),

      reset: () => set({ hasOnboarded: false }),
    }),
    {
      name: 'hive-onboarding',
      storage: createJSONStorage(() => AsyncStorage),
      // Only the flag itself belongs in storage. Persisting `hasHydrated` would
      // write a value that is meaningless on the next launch.
      partialize: (state) => ({ hasOnboarded: state.hasOnboarded }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          logger.error('Could not read the onboarding flag', error);
        }
        // Set even when the read failed. A storage error is a reason to fall
        // back to the default, not to leave every reader waiting forever on a
        // blank screen.
        useOnboardingStore.setState({ hasHydrated: true });
      },
    },
  ),
);
