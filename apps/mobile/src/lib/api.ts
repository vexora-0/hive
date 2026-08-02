import Constants from 'expo-constants';
import { supabase } from './supabase';
import { logger } from '@/utils/logger';

const API_URL = Constants.expoConfig?.extra?.apiUrl ?? process.env.EXPO_PUBLIC_API_URL ?? '';

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

export async function apiRequest<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {} } = options;

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;

  const response = await fetch(`${API_URL}/api/v1${endpoint}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    logger.error(`API Error ${response.status}:`, errorBody);

    // Session expired — clear stored session and let the auth listener redirect to login
    if (response.status === 401) {
      await supabase.auth.signOut();
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
