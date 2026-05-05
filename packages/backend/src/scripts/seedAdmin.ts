/**
 * Seed an admin user with email + password via the Supabase Admin API.
 *
 * Usage:  npm run seed:admin   (from packages/backend)
 *
 * This is idempotent — safe to run multiple times.
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

// Credentials come from the environment. There is deliberately no default —
// a committed admin password is a credential leak, not a convenience.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME ?? 'Hive Admin';

const missing = [
  ['SUPABASE_URL', SUPABASE_URL],
  ['SUPABASE_SERVICE_KEY', SUPABASE_SERVICE_KEY],
  ['ADMIN_EMAIL', ADMIN_EMAIL],
  ['ADMIN_PASSWORD', ADMIN_PASSWORD],
]
  .filter(([, value]) => !value)
  .map(([name]) => name);

if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(', ')}`);
  console.error('Set them in packages/backend/.env before running this script.');
  process.exit(1);
}

// Narrowed after the guard above so the rest of the script works with plain strings.
const supabaseUrl: string = SUPABASE_URL!;
const supabaseServiceKey: string = SUPABASE_SERVICE_KEY!;
const adminEmail: string = ADMIN_EMAIL!;
const adminPassword: string = ADMIN_PASSWORD!;

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seedAdmin() {
  console.log(`Seeding admin user: ${adminEmail}`);

  // Check if profile already exists
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, role')
    .eq('email', adminEmail)
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
    email: adminEmail,
    password: adminPassword,
    email_confirm: true,
    user_metadata: { role: 'admin', full_name: ADMIN_NAME },
  });

  if (authError) {
    // User may already exist in auth but not profiles (e.g. after a reset)
    if (authError.message.includes('already been registered')) {
      console.log('Auth user already exists. Checking profile...');
      const { data: users } = await supabase.auth.admin.listUsers();
      const user = users?.users.find((u) => u.email === adminEmail);
      if (user) {
        await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            email: adminEmail,
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

  // Never log the password — this output ends up in terminals, CI logs and screenshots.
  console.log('Admin user seeded successfully.');
  console.log('  Email: %s', adminEmail);
}

seedAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Unexpected error:', err);
    process.exit(1);
  });
