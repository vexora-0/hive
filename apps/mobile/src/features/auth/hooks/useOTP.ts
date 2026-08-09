import { useCallback, useEffect, useState } from 'react';
import {
  MAX_OTP_ATTEMPTS,
  LOCKOUT_DURATION_SEC,
  RESEND_COOLDOWN_SEC,
} from '@/theme';
import * as authService from '../services/authService';
import { useOtpThrottleStore, secondsUntil } from '../stores/otpThrottleStore';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseOTPReturn {
  /** True while the send-OTP request is in flight. */
  isSending: boolean;
  /** True while the verify-OTP request is in flight. */
  isVerifying: boolean;
  /** Whether the user can request a new code (cooldown expired). */
  canResend: boolean;
  /** Seconds remaining before the user can resend (0 when ready). */
  resendCountdown: number;
  /** How many more attempts the user has before lockout. */
  attemptsRemaining: number;
  /** True when the user has been locked out. */
  isLockedOut: boolean;
  /** Seconds remaining in the lockout period (0 when not locked). */
  lockoutRemaining: number;
  /** Human-readable error message, or null. */
  error: string | null;
  /** Request a new OTP for `email`. Pass `role` for new signups so profile is created with that role. */
  sendOTP: (email: string, role?: 'teacher' | 'parent') => Promise<boolean>;
  /** Verify `token` against the OTP sent to `email`. Returns true on success. */
  verifyOTP: (email: string, token: string) => Promise<boolean>;
  /** Call this to trigger a shake on the OTP input (returns a trigger callback). */
  triggerShake: () => void;
  /** Monotonically incrementing counter — bump this to fire a shake. */
  shakeKey: number;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useOTP(): UseOTPReturn {
  // ── Async flags ────────────────────────────────────────────────────
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Attempts / lockout / cooldown ──────────────────────────────────
  // Held in a module-level store, not in this hook: login and verify-otp each
  // create their own instance, so per-instance state meant navigating between
  // them reset both the lockout and the resend cooldown.
  const attempts = useOtpThrottleStore((s) => s.attempts);
  const lockoutUntil = useOtpThrottleStore((s) => s.lockoutUntil);
  const resendCooldownUntil = useOtpThrottleStore((s) => s.resendCooldownUntil);
  const recordFailure = useOtpThrottleStore((s) => s.recordFailure);
  const beginResendCooldown = useOtpThrottleStore((s) => s.startResendCooldown);
  const clearExpired = useOtpThrottleStore((s) => s.clearExpired);
  const resetThrottle = useOtpThrottleStore((s) => s.reset);

  // Re-derived once a second so the displayed countdowns tick down. The values
  // themselves come from the deadlines, so they stay right across unmounts.
  const [, forceTick] = useState(0);
  const lockoutRemaining = secondsUntil(lockoutUntil);
  const resendCountdown = secondsUntil(resendCooldownUntil);

  // ── Shake trigger ──────────────────────────────────────────────────
  const [shakeKey, setShakeKey] = useState(0);
  const triggerShake = useCallback(() => {
    setShakeKey((k) => k + 1);
  }, []);

  // ── Derived booleans ───────────────────────────────────────────────
  const isLockedOut = lockoutRemaining > 0;
  const canResend = !isSending && resendCountdown === 0 && !isLockedOut;
  const attemptsRemaining = Math.max(MAX_OTP_ATTEMPTS - attempts, 0);

  // ── Countdown ticker ───────────────────────────────────────────────
  // One interval for both countdowns, running only while one is active.
  //
  // `clearExpired` is what makes "only while active" true. The deadlines are
  // the effect's dependencies, and nothing but a successful verification used
  // to null them, so the interval outlived the countdown: from the first "Send
  // code" the screen re-rendered every second for the rest of its mounted life,
  // rebuilding `sendOTP` and `verifyOTP` on each tick because they depend on
  // `lockoutRemaining`. Nulling an expired deadline re-runs this effect, which
  // then takes the early return and leaves no interval behind.
  useEffect(() => {
    if (lockoutUntil === null && resendCooldownUntil === null) return;

    // A deadline can also have passed while this screen was unmounted or the
    // app was backgrounded; don't make the user wait a tick to find out.
    clearExpired();

    const id = setInterval(() => {
      clearExpired();
      forceTick((n) => n + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [lockoutUntil, resendCooldownUntil, clearExpired]);

  const startResendCooldown = useCallback(() => {
    beginResendCooldown(RESEND_COOLDOWN_SEC);
  }, [beginResendCooldown]);

  // ── Send OTP ───────────────────────────────────────────────────────
  const sendOTP = useCallback(
    async (email: string, role?: 'teacher' | 'parent'): Promise<boolean> => {
      if (isLockedOut) {
        setError(`Too many attempts. Try again in ${lockoutRemaining}s.`);
        return false;
      }

      try {
        setIsSending(true);
        setError(null);
        await authService.sendOTP(email, role);
        startResendCooldown();
        return true;
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Failed to send verification code.';
        setError(message);
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [isLockedOut, lockoutRemaining, startResendCooldown],
  );

  // ── Verify OTP ─────────────────────────────────────────────────────
  const verifyOTP = useCallback(
    async (email: string, token: string): Promise<boolean> => {
      if (isLockedOut) {
        setError(`Too many attempts. Try again in ${lockoutRemaining}s.`);
        return false;
      }

      try {
        setIsVerifying(true);
        setError(null);
        await authService.verifyOTP(email, token);
        // Success — clear the throttle so a later sign-in on this device is not
        // penalised for it, and let the auth state listener handle navigation.
        resetThrottle();
        return true;
      } catch (err: unknown) {
        const nextAttempts = recordFailure(MAX_OTP_ATTEMPTS, LOCKOUT_DURATION_SEC);
        triggerShake();

        if (nextAttempts >= MAX_OTP_ATTEMPTS) {
          setError(
            `Too many failed attempts. Locked out for ${Math.ceil(LOCKOUT_DURATION_SEC / 60)} minutes.`,
          );
        } else {
          const message =
            err instanceof Error ? err.message : 'Invalid code. Please try again.';
          setError(message);
        }
        return false;
      } finally {
        setIsVerifying(false);
      }
    },
    [isLockedOut, lockoutRemaining, recordFailure, resetThrottle, triggerShake],
  );

  return {
    isSending,
    isVerifying,
    canResend,
    resendCountdown,
    attemptsRemaining,
    isLockedOut,
    lockoutRemaining,
    error,
    sendOTP,
    verifyOTP,
    triggerShake,
    shakeKey,
  };
}
