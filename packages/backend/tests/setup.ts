import 'dotenv/config';
import { config } from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { beforeAll } from 'vitest';

// .env.test overrides .env — tests must never touch the development or demo
// project, because the harness truncates tables.
config({ path: '.env.test', override: true });

const TEST_URL = process.env.SUPABASE_URL;
const TEST_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!TEST_URL || !TEST_KEY) {
  throw new Error(
    'SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in packages/backend/.env.test.\n' +
      'See docs/environment-setup.md — the test project must be SEPARATE from development.',
  );
}

/**
 * Refuse to run against the development project.
 *
 * The suite truncates every domain table. Pointing it at the project holding
 * the demo dataset would wipe the data you are about to present, and it would
 * happen silently. This guard is deliberately loud and unconditional.
 */
const devUrl = process.env.DEV_SUPABASE_URL;
if (devUrl && devUrl === TEST_URL) {
  throw new Error(
    `REFUSING TO RUN: .env.test points at the same Supabase project as .env (${TEST_URL}).\n` +
      'The test suite truncates tables. Create a separate project first.',
  );
}

/**
 * Second guard, for the case the one above cannot cover.
 *
 * The check above only fires when DEV_SUPABASE_URL happens to be set, so it is
 * silent on a machine that never configured it — which is exactly the machine
 * most likely to get this wrong. The demo project ref is committed at
 * `supabase/README_MIGRATIONS.md:20`, so it can be named outright.
 *
 * Hard-coded on purpose: a guard that reads the value it is guarding against
 * from configuration guards nothing.
 */
const FORBIDDEN_PROJECT_REFS = ['fhvwsmtivwtmbdscdoyz'];

for (const ref of FORBIDDEN_PROJECT_REFS) {
  if (TEST_URL.includes(ref)) {
    throw new Error(
      `REFUSING TO RUN.\n\n` +
        `SUPABASE_URL points at project "${ref}", which is the demo project.\n` +
        `This suite truncates every domain table and deletes auth users. ` +
        `Running it here would wipe the demo data.\n\n` +
        `Point .env.test at a separate Supabase project.`,
    );
  }
}

if (process.env.NODE_ENV === 'production') {
  throw new Error('REFUSING TO RUN: NODE_ENV is production.');
}

export const supabaseTest: SupabaseClient = createClient(TEST_URL, TEST_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const TEST_PASSWORD = process.env.DEMO_PASSWORD ?? 'test-only-password';

/** Truncate domain tables in foreign-key-safe order. */
export async function truncateAll(): Promise<void> {
  const inDependencyOrder = [
    'order_items',
    'orders',
    'notifications',
    'photo_student_tags',
    'photos',
    'parent_student_mappings',
    'students',
    'classes',
  ];
  for (const table of inDependencyOrder) {
    await supabaseTest.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
  }
  // profiles cascade from auth.users; schools last since everything references it.
  await supabaseTest.from('schools').delete().neq('id', '00000000-0000-0000-0000-000000000000');
}

beforeAll(async () => {
  await truncateAll();
});
