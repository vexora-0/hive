import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';
import { AppError } from '../middleware/errorHandler';
import type { UpdateProfileInput } from '../validators/profile.validator';

/**
 * The caller's own profile. Every field here is one the caller already knows
 * about themselves, so there is nothing to scope beyond the user ID.
 */
export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: string;
  school_id: string | null;
  avatar_url: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string;
}

const PROFILE_COLUMNS =
  'id, email, full_name, role, school_id, avatar_url, phone, is_active, created_at';

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    logger.error('Failed to fetch profile', { error: error.message, userId });
    throw new AppError('Failed to fetch profile', 500, 'QUERY_FAILED');
  }

  // `authenticate` already 401s when the profile row is missing, so reaching
  // here means it vanished between the two queries. 404 is still the honest
  // answer.
  if (!data) {
    throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
  }

  return data as Profile;
}

/**
 * Update the caller's own profile.
 *
 * Scoped by `.eq('id', userId)` from `req.user`, never from the body, so there
 * is no ID for a caller to substitute. The validator admits only `fullName`
 * and `phone`; role and school stay admin-only. (M-10)
 */
export async function updateProfile(
  userId: string,
  data: UpdateProfileInput,
): Promise<Profile> {
  const patch: Record<string, string | null> = {};
  if (data.fullName !== undefined) patch.full_name = data.fullName;
  if (data.phone !== undefined) patch.phone = data.phone;

  if (Object.keys(patch).length === 0) {
    throw new AppError('No fields to update', 400, 'NO_FIELDS');
  }

  patch.updated_at = new Date().toISOString();

  const { data: updated, error } = await supabaseAdmin
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select(PROFILE_COLUMNS)
    .maybeSingle();

  if (error) {
    logger.error('Failed to update profile', { error: error.message, userId });
    throw new AppError('Failed to update profile', 500, 'UPDATE_FAILED');
  }

  if (!updated) {
    throw new AppError('Profile not found', 404, 'PROFILE_NOT_FOUND');
  }

  logger.info('Profile updated', { userId, fields: Object.keys(patch) });
  return updated as Profile;
}
