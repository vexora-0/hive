import Constants from 'expo-constants';
import { supabase } from './supabase';
import { logger } from '@/utils/logger';

const API_URL = Constants.expoConfig?.extra?.apiUrl ?? process.env.EXPO_PUBLIC_API_URL ?? '';

/** Deadline for a single API call. File uploads set their own, much longer. */
const REQUEST_TIMEOUT_MS = 30_000;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  // A bare fetch has no deadline, so a stalled connection leaves the promise
  // unsettled forever: React Query's retry never fires because nothing ever
  // rejects, and the screen keeps its spinner indefinitely.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/v1${endpoint}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      signal: controller.signal,
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  } catch (err) {
    if (controller.signal.aborted) {
      throw new Error('The request timed out. Check your connection and try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    logger.error(`API Error ${response.status}:`, errorBody);

    if (response.status === 401) {
      // Not every 401 means "your session is over". The backend also answers
      // 401 when the profile row is missing, and a token can be momentarily
      // stale at the refresh boundary. Signing out unconditionally ejected
      // people mid-task — a teacher halfway through tagging an upload lost the
      // screen — and the unread-count poll runs every 30s from every screen, so
      // there was always a request in flight to trigger it.
      //
      // Ask for a refresh instead, and only sign out if the session really is
      // unrecoverable.
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (!refreshed.session) {
        logger.error('Session could not be refreshed; signing out');
        await supabase.auth.signOut();
      }
    }

    throw new ApiError(response.status, errorBody.message ?? 'Request failed', errorBody);
  }

  // A 204 carries no body, so response.json() would throw on the empty string.
  // The DELETE routes (archive a photo, untag a student) answer 204, and their
  // callers want the rejection to mean "the request failed" — not "the request
  // succeeded and then parsing blew up".
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public data?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
