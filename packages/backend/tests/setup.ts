import path from 'path';
import dotenv from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { beforeAll } from 'vitest';

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------
//
// Tests read .env.test, never .env. They create and delete auth users and
// truncate every domain table, so pointing them at the demo project would
// destroy the data the demo runs on.

dotenv.config({ path: path.resolve(__dirname, '..', '.env.test') });

/**
 * Supabase project ref of the demo/production project, committed at
 * `supabase/README_MIGRATIONS.md:20`.
 *
 * Hard-coded on purpose: a guard that reads the value it is guarding against
 * from configuration guards nothing.
 */
const FORBIDDEN_PROJECT_REFS = ['fhvwsmtivwtmbdscdoyz'];

function assertSafeTestDatabase(): void {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !key) {
    throw new Error(
      'Tests require SUPABASE_URL and SUPABASE_SERVICE_KEY in packages/backend/.env.test.\n' +
        'Copy .env.test.example and point it at a SEPARATE Supabase project — ' +
        'never the demo project. See docs/plans/08-testing.md Step 1.',
    );
  }

  for (const ref of FORBIDDEN_PROJECT_REFS) {
    if (url.includes(ref)) {
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
}

assertSafeTestDatabase();

// ---------------------------------------------------------------------------
// Test client
// ---------------------------------------------------------------------------

/**
 * Service-role client for fixtures and assertions.
 *
 * This is the same key the application uses, and it bypasses RLS the same way,
 * which is what makes it usable for setup and teardown. Tests that need to
 * prove an authorization rule must go through the HTTP layer with a real user
 * token — asserting against this client proves nothing about the API.
 */
export const supabaseTest: SupabaseClient = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

// ---------------------------------------------------------------------------
// Truncation
// ---------------------------------------------------------------------------

/**
 * Domain tables in foreign-key-safe deletion order: children before parents.
 *
 * `profiles` is omitted deliberately — rows there are created by the
 * `handle_new_user` trigger and removed when the auth user is deleted, so
 * `cleanup()` in helpers.ts owns them.
 */
const TABLES_IN_DELETE_ORDER = [
  'order_items',
  'orders',
  'notifications',
  'photo_student_tags',
  'photos',
  'parent_student_mappings',
  'students',
  'classes',
  'schools',
] as const;

/**
 * Delete every row from the domain tables.
 *
 * PostgREST has no TRUNCATE, so this is a delete-all per table, ordered so
 * foreign keys never block it. `.neq('id', ...)` on an impossible UUID is the
 * standard way to express "no filter" — PostgREST rejects an unfiltered
 * delete outright, which is a good default we have to opt out of here.
 */
export async function truncateAll(): Promise<void> {
  const IMPOSSIBLE_ID = '00000000-0000-0000-0000-000000000000';

  for (const table of TABLES_IN_DELETE_ORDER) {
    const { error } = await supabaseTest
      .from(table)
      .delete()
      .neq('id', IMPOSSIBLE_ID);

    if (error) {
      throw new Error(`Failed to clear "${table}": ${error.message}`);
    }
  }
}

beforeAll(async () => {
  await truncateAll();
});
