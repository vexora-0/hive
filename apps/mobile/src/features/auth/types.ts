import type { Session, User } from '@supabase/supabase-js';
import type { Tables, UserRole } from '@/types/supabase';

// ---------------------------------------------------------------------------
// Auth state — persisted in the Zustand auth store
// ---------------------------------------------------------------------------

export interface AuthState {
  /** Active Supabase session (null when signed out). */
  session: Session | null;
  /** Current Supabase user derived from the session. */
  user: User | null;
  /** Profile row from the `profiles` table. */
  profile: Tables<'profiles'> | null;
  /** Resolved role for quick guard checks. */
  role: UserRole | null;
  /** True while the initial session check is in-flight. */
  isLoading: boolean;
  /** Convenience flag derived from `session !== null`. */
  isAuthenticated: boolean;
}

// ---------------------------------------------------------------------------
// OTP flow state — local to the verify-otp screen via useOTP hook
// ---------------------------------------------------------------------------

export interface OTPState {
  /** Email address the OTP was sent to. */
  email: string;
  /** Number of failed verification attempts in the current cycle. */
  otpAttempts: number;
  /** Unix-ms timestamp until which the user is locked out (null if not locked). */
  lockoutUntil: number | null;
  /** Unix-ms timestamp until which the "Resend" button is disabled (null if ready). */
  resendCooldownEnd: number | null;
}
