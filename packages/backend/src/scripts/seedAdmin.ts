/**
 * Seed an admin user with email + password via the Supabase Admin API.
 *
 * Usage:
 *   ADMIN_EMAIL=… ADMIN_PASSWORD=… pnpm seed:admin   (from packages/backend)
 *
 * or set both in `.env`. There is no default — a default admin password is a
 * default admin account, and every environment the script has ever run against
 * would share it.
 *
 * This is idempotent — safe to run multiple times.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME ?? 'Hive Admin';

if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error(
    'Missing ADMIN_EMAIL or ADMIN_PASSWORD.\n' +
      'Set both in packages/backend/.env or pass them on the command line.\n' +
      'There is deliberately no fallback: a default password would be shared ' +
      'by every environment this script has been run against.',
  );
  process.exit(1);
}

async function seedAdmin() {
  console.log(`Seeding admin user: ${ADMIN_EMAIL}`);

  // Check if profile already exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('email', ADMIN_EMAIL)
    .single();

  if (existing) {
    console.log('Admin profile already exists (id: %s, role: %s)', existing.id, existing.role);
    if (existing.role !== 'admin') {
      await supabase.from('profiles').update({ role: 'admin' }).eq('id', existing.id);
      console.log('Updated role to admin.');
    }
    console.log('Done.');
    return;
  }

  // Create auth user with email + password
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true,
    user_metadata: { role: 'admin', full_name: ADMIN_NAME },
  });

  if (authError) {
    // User may already exist in auth but not profiles (e.g. after a reset)
    if (authError.message.includes('already been registered')) {
      console.log('Auth user already exists. Checking profile...');
      const { data: users } = await supabase.auth.admin.listUsers();
      const user = users?.users.find((u) => u.email === ADMIN_EMAIL);
      if (user) {
        await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            email: ADMIN_EMAIL,
            full_name: ADMIN_NAME,
            role: 'admin',
          });
        console.log('Profile upserted for existing auth user.');
      }
      return;
    }
    console.error('Failed to create auth user:', authError.message);
    process.exit(1);
  }

  console.log('Auth user created: %s', authData.user.id);

  // The handle_new_user trigger creates a profile with role='parent'.
  // Update it to 'admin'.
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ role: 'admin', full_name: ADMIN_NAME })
    .eq('id', authData.user.id);

  if (updateError) {
    console.error('Failed to update profile:', updateError.message);
    process.exit(1);
  }

  // The password is never echoed. Whoever ran this set it, so they know it;
  // printing it puts it into shell history, CI logs and terminal scrollback.
  console.log('Admin user seeded successfully.');
  console.log('  Email: %s', ADMIN_EMAIL);
}

seedAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
