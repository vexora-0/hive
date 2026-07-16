import http from 'k6/http';
import { fail } from 'k6';

const SUPABASE_URL = __ENV.SUPABASE_URL;
const SUPABASE_ANON_KEY = __ENV.SUPABASE_ANON_KEY;

/**
 * Exchange demo credentials for a Supabase access token.
 *
 * Called once in setup() and shared across VUs. Signing in per-iteration would
 * measure Supabase Auth's rate limiter rather than the Hive API.
 */
export function signIn(email, password) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    fail('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  }

  const res = http.post(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    JSON.stringify({ email, password }),
    {
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY },
      tags: { name: 'auth:signIn' },
    },
  );

  if (res.status !== 200) {
    fail(`Sign-in failed for ${email}: ${res.status} ${res.body}`);
  }
  return JSON.parse(res.body).access_token;
}

export function authHeaders(token, extra = {}) {
  return {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...extra },
  };
}
