import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { logger } from '@/utils/logger';
import type { Database } from '@/types/supabase';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Session storage.
 *
 * Every operation is still non-throwing — auth-js treats a storage error as
 * fatal to the whole auth flow — but they are no longer silent. A failed write
 * means the session is not persisted, so the user is signed out again on the
 * next cold start; with nothing logged anywhere that presented as "the app
 * randomly forgets me" and was undiagnosable from the app, Sentry, or the
 * logs. A Supabase session (access JWT, refresh token, and the full user
 * object) can also exceed expo-secure-store's 2048-byte guidance, which is a
 * real way for the write to fail rather than a hypothetical one.
 */
const SecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (err) {
      logger.error('Could not read the stored session', err);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (err) {
      logger.error(
        `Could not persist the session (${value.length} bytes); the user will be signed out on next launch`,
        err,
      );
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (err) {
      // Worth knowing about: a failure here can leave a session behind after
      // what the UI reported as a sign-out.
      logger.error('Could not clear the stored session', err);
    }
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: SecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
