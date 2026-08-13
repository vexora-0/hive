import { vi } from 'vitest';

/**
 * The native edges, stubbed once.
 *
 * Nothing in this suite renders or talks to a network. But the modules under
 * test sit a couple of imports away from things that only exist inside a Metro
 * bundle running on a device: `expo-modules-core` reads a `globalThis.expo`
 * object injected by the native runtime, `expo-secure-store` is a thin wrapper
 * over the keychain, and `createClient` throws outright when the Supabase URL
 * is empty — which it is here, because env vars come from `app.json` `extra`
 * at build time.
 *
 * Stubbing them here rather than in each test keeps the test files about the
 * behaviour they are checking. Everything actually under test — the retry
 * policy, the content-type negotiation, `ApiError` itself — is the real
 * module; only the edges below are replaced.
 */

// `Constants.expoConfig?.extra` is read at module scope by `@/lib/api` and
// `teacherService` to find the API URL. Optional chaining means null is a
// valid answer; the code then falls back to `process.env`.
vi.mock('expo-constants', () => ({ default: { expoConfig: null } }));

// Reached only through `@/lib/api`, which every service imports for `ApiError`.
// No test issues a request, so the client itself is never exercised.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: null } })),
      refreshSession: vi.fn(async () => ({ data: { session: null } })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  },
}));

// Native haptics: `useUpload` fires these on batch start and completion.
vi.mock('expo-haptics', () => ({
  impactAsync: vi.fn(async () => {}),
  notificationAsync: vi.fn(async () => {}),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));

// Reanimated, reached through `@/theme`.
//
// The theme barrel now re-exports `theme/motion.ts`, which holds every spring,
// duration and easing curve in the app. That file imports `Easing` and
// `ReduceMotion` from Reanimated, so *any* module that reads a token — a
// colour, a spacing step, `MAX_UPLOAD_IMAGES` — now transitively loads
// Reanimated, and Reanimated reaches for a native worklets module that does
// not exist outside Metro.
//
// Only the two values `theme/motion.ts` evaluates at module scope are needed
// here. Nothing under test animates; if that changes, this stub grows.
vi.mock('react-native-reanimated', () => {
  const identity = (t: number) => t;
  const curve = () => identity;
  return {
    Easing: {
      bezier: curve,
      in: curve,
      out: curve,
      inOut: curve,
      cubic: identity,
      quad: identity,
      linear: identity,
    },
    ReduceMotion: { System: 'system', Always: 'always', Never: 'never' },
    useReducedMotion: () => false,
  };
});

// The toast barrel drags in the whole component library — Reanimated worklets,
// Moti, Skia — none of which loads outside Metro. `useUpload` uses exactly one
// export from it.
vi.mock('@/components/feedback', () => ({
  useToast: () => ({
    show: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));
