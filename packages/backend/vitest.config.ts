import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],

    // Every test makes real network calls to Supabase — auth admin operations
    // in particular are slow. The default 5s timeout is not enough.
    testTimeout: 20_000,
    hookTimeout: 30_000,

    // All suites share one database, so they must not run concurrently.
    // Without this, one file's truncation wipes another file's fixtures
    // mid-run and the failures look like real bugs.
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    fileParallelism: false,
  },
});
