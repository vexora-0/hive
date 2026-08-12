import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Node-environment unit tests for the mobile app.
 *
 * Deliberately NOT a React Native renderer harness. There is no `jest-expo`
 * preset, no `@testing-library/react-native` and no snapshot: rendering a
 * component tree here would need the whole native module surface stubbed, and
 * the result would break on every Expo bump without ever catching a real
 * defect. What this suite covers is the pure logic — route resolution, the
 * order-number formatter, the retry policy, content-type negotiation and the
 * two zustand stores — which is where the August fixes actually live and which
 * runs unmodified under plain Node.
 *
 * `.mts` matches the backend's config for the same reason: Vitest 4 loads the
 * config file natively and a `.ts` file here is ambiguous about module format.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `react-native`'s entry point is Flow-typed source that no non-Metro
      // bundler can parse. Nothing under test renders anything, but one module
      // reaches it transitively: `useUpload` imports `@/theme`, and
      // `theme/shadows.ts` branches on `Platform.OS`. Redirecting to
      // `react-native-web` — already a dependency, and plain JS — satisfies
      // that without a stub of our own.
      'react-native': 'react-native-web',
    },
  },
  // Metro injects `__DEV__`; expo-modules-core reads it at module scope.
  define: { __DEV__: 'false' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // Every test here is pure and in-process; nothing shares a database, so
    // unlike the backend suite these can run in parallel.
    globals: false,
  },
});
