import { defineConfig } from 'vitest/config';

// .mts because the backend package is CommonJS — Vitest 4 loads the config
// natively and rejects ESM syntax in a .ts file here.
export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // Real network calls to Supabase, plus image processing on upload tests.
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Every test shares one database, so they must not run concurrently.
    // poolOptions was removed in Vitest 4 — these are top-level now.
    pool: 'forks',
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
  },
});
