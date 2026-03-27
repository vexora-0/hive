import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MAX_OTP_ATTEMPTS,
  LOCKOUT_DURATION_SEC,
  RESEND_COOLDOWN_SEC,
} from '@/theme';
import * as authService from '../services/authService';

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

  // ── Attempts / lockout ─────────────────────────────────────────────
  const [otpAttempts, setOtpAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);

  // ── Resend cooldown ────────────────────────────────────────────────
  const [resendCooldownEnd, setResendCooldownEnd] = useState<number | null>(null);
  const [resendCountdown, setResendCountdown] = useState(0);

  // ── Shake trigger ──────────────────────────────────────────────────
  const [shakeKey, setShakeKey] = useState(0);
  const triggerShake = useCallback(() => {
    setShakeKey((k) => k + 1);
  }, []);

  // ── Interval refs (cleaned up on unmount) ──────────────────────────
  const resendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockoutIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Derived booleans ───────────────────────────────────────────────
  const isLockedOut = lockoutUntil !== null && Date.now() < lockoutUntil;
  const canResend = !isSending && resendCountdown === 0 && !isLockedOut;
  const attemptsRemaining = Math.max(MAX_OTP_ATTEMPTS - otpAttempts, 0);

  // ── Resend cooldown timer ──────────────────────────────────────────
  const startResendCooldown = useCallback(() => {
    const end = Date.now() + RESEND_COOLDOWN_SEC * 1000;
    setResendCooldownEnd(end);
    setResendCountdown(RESEND_COOLDOWN_SEC);

    // Clear any existing interval
    if (resendIntervalRef.current) {
      clearInterval(resendIntervalRef.current);
    }

    resendIntervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setResendCountdown(remaining);
      if (remaining <= 0 && resendIntervalRef.current) {
        clearInterval(resendIntervalRef.current);
        resendIntervalRef.current = null;
        setResendCooldownEnd(null);
      }
    }, 1000);
  }, []);

  // ── Lockout timer ──────────────────────────────────────────────────
  const startLockout = useCallback(() => {
    const until = Date.now() + LOCKOUT_DURATION_SEC * 1000;
    setLockoutUntil(until);
    setLockoutRemaining(LOCKOUT_DURATION_SEC);

    if (lockoutIntervalRef.current) {
      clearInterval(lockoutIntervalRef.current);
    }

    lockoutIntervalRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setLockoutRemaining(remaining);
      if (remaining <= 0) {
        if (lockoutIntervalRef.current) {
          clearInterval(lockoutIntervalRef.current);
          lockoutIntervalRef.current = null;
        }
        setLockoutUntil(null);
        setOtpAttempts(0);
      }
    }, 1000);
  }, []);

  // ── Cleanup on unmount ─────────────────────────────────────────────
  useEffect(() => {
    return () => {
      if (resendIntervalRef.current) clearInterval(resendIntervalRef.current);
      if (lockoutIntervalRef.current) clearInterval(lockoutIntervalRef.current);
    };
  }, []);

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
        // Success — the auth state listener will handle navigation.
        return true;
      } catch (err: unknown) {
        const nextAttempts = otpAttempts + 1;
        setOtpAttempts(nextAttempts);
        triggerShake();

        if (nextAttempts >= MAX_OTP_ATTEMPTS) {
          startLockout();
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
    [isLockedOut, lockoutRemaining, otpAttempts, startLockout, triggerShake],
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
