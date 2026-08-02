import { apiRequest } from '@/lib/api';
import type { Tables } from '@/types/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UpdateProfilePayload {
  fullName?: string;
  /** `null` clears the number; omitting it leaves the stored one alone. */
  phone?: string | null;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * Fetch the signed-in user's own profile.
 *
 * Goes through the API rather than querying Supabase directly, unlike
 * `authStore.initialize`. Both work; this one keeps the update and the read on
 * the same path, so they cannot disagree about which fields exist.
 */
export async function getMe(): Promise<Tables<'profiles'>> {
  const res = await apiRequest<{ success: true; data: Tables<'profiles'> }>('/me');
  return res.data;
}

/**
 * Update the signed-in user's own name and phone.
 *
 * The server accepts nothing else — role and school are admin-only, and email
 * is the login identity and lives in Supabase Auth.
 */
export async function updateMe(
  data: UpdateProfilePayload,
): Promise<Tables<'profiles'>> {
  const res = await apiRequest<{ success: true; data: Tables<'profiles'> }>('/me', {
    method: 'PATCH',
    body: data,
  });
  return res.data;
}
