import { supabase } from '@/lib/supabase';
import { logger } from '@/utils/logger';
import type { Tables, UserRole } from '@/types/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ProfileWithRole {
  profile: Tables<'profiles'>;
  role: UserRole;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Request Supabase to send an email OTP to `email`.
 * For new signups, `role` is stored in user metadata so the DB trigger can create the profile with that role.
 * Throws on network / server errors.
 */
export async function sendOTP(
  email: string,
  role?: 'teacher' | 'parent',
): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: role ? { role } : {},
    },
  });

  if (error) {
    throw error;
  }
}

/**
 * Verify the OTP `token` for the given `email`.
 * On success the Supabase SDK automatically stores the session.
 * Throws on invalid token or network errors.
 */
export async function verifyOTP(
  email: string,
  token: string,
): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email', // works for both OTP and magic link tokens
  });

  if (error) {
    throw error;
  }
}

/**
 * Sign in with email and password.
 *
 * Admin always; teacher and parent when they opt out of the OTP flow on the
 * login screen. Not restricted by role — Supabase authenticates whoever the
 * credentials belong to, and the role is resolved afterwards from `profiles`.
 *
 * On success the Supabase SDK automatically stores the session.
 * Throws on invalid credentials or network errors.
 */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }
}

/**
 * Fetch the `profiles` row for `userId`.
 * Returns the profile with its role, or `null` if the row doesn't exist yet
 * (e.g. new user before onboarding completes).
 */
export async function fetchUserProfile(
  userId: string,
): Promise<ProfileWithRole | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  // "No row" and "the request failed" are different answers and must not share
  // a return value. Collapsing both to null meant a transient network failure
  // looked exactly like a brand-new user, so a signed-in parent was dropped
  // into the four-slide marketing carousel — and, if the retry there failed
  // too, bounced to a login screen they were already past, which is a loop.
  //
  // PGRST116 is PostgREST's "zero rows for .single()". Only that is null;
  // everything else throws and the caller decides.
  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }
    logger.error('Failed to fetch user profile', error);
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    profile: data,
    role: data.role,
  };
}

/**
 * Sign the current user out.
 */
export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
