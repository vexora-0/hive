import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OnboardingState {
  /** Whether the user has completed the onboarding flow. */
  hasOnboarded: boolean;
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

      completeOnboarding: () => set({ hasOnboarded: true }),

      reset: () => set({ hasOnboarded: false }),
    }),
    {
      name: 'hive-onboarding',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
