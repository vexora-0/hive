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
    //
    // These settings work, and are not where suite flakiness comes from: files
    // were traced and run strictly sequentially, one fork at a time, with no
    // truncate ever overlapping another file's tests. The flakiness was two
    // *separate runs* of this suite colliding on the shared `hive-test`
    // project, which no amount of intra-run serialisation can fix — see
    // `cleanupCreatedRows` in tests/setup.ts before reaching for this knob.
    pool: 'forks',
    fileParallelism: false,
    maxWorkers: 1,
    minWorkers: 1,
  },
});
