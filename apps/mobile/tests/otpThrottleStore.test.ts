import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import {
  useOtpThrottleStore,
  secondsUntil,
} from '@/features/auth/stores/otpThrottleStore';

/**
 * OTP attempt and cooldown throttling.
 *
 * Two separate defects lived here, and both were invisible to a typecheck:
 *
 * 1. The state used to live inside `useOTP`. Login and verify-otp each call
 *    that hook, so each got its own copy: the 60s resend cooldown started on
 *    login's copy, verify-otp's copy read zero, and "Resend Code" was live the
 *    instant the user arrived — straight into Supabase's own limit and a
 *    security warning on a screen they had just landed on. Tapping back and
 *    re-sending likewise handed the user a fresh copy with `attempts` at zero,
 *    so the lockout was decorative.
 * 2. Once shared, the attempt count did not reset when the lockout it belonged
 *    to expired. `attempts` stayed at the maximum, the screen read "0 attempts
 *    remaining" forever, and the next single wrong digit tripped
 *    `attempts >= maxAttempts` again for another full-length lockout. A
 *    five-minute lockout became a permanent one-strike lockout.
 *
 * The store is keyed on deadlines rather than countdowns, so these are
 * time-dependent and run on fake timers. Values match `@/theme/constants`:
 * MAX_OTP_ATTEMPTS 3, LOCKOUT_DURATION_SEC 300, RESEND_COOLDOWN_SEC 60.
 */

const MAX_ATTEMPTS = 3;
const LOCKOUT_SEC = 300;
const RESEND_SEC = 60;

const store = () => useOtpThrottleStore.getState();

describe('otpThrottleStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T09:00:00Z'));
    useOtpThrottleStore.getState().reset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fakes Date.now, which the whole file depends on', () => {
    // Guard on the harness itself: every assertion below is meaningless if the
    // store is reading a real clock.
    expect(Date.now()).toBe(new Date('2026-08-12T09:00:00Z').getTime());
  });

  describe('counting failures', () => {
    it('counts up and locks out on the last allowed attempt', () => {
      expect(store().recordFailure(MAX_ATTEMPTS, LOCKOUT_SEC)).toBe(1);
      expect(store().lockoutUntil).toBeNull();

      expect(store().recordFailure(MAX_ATTEMPTS, LOCKOUT_SEC)).toBe(2);
      expect(store().lockoutUntil).toBeNull();

      expect(store().recordFailure(MAX_ATTEMPTS, LOCKOUT_SEC)).toBe(3);
      expect(store().lockoutUntil).toBe(Date.now() + LOCKOUT_SEC * 1000);
      expect(secondsUntil(store().lockoutUntil)).toBe(LOCKOUT_SEC);
    });
  });

  describe('a served lockout buys the attempts back', () => {
    it('resets the count on the first failure after the lockout expires', () => {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        store().recordFailure(MAX_ATTEMPTS, LOCKOUT_SEC);
      }
      expect(store().attempts).toBe(MAX_ATTEMPTS);

      // Serve the full lockout, without anything having called clearExpired —
      // the reset must not depend on a ticker having been mounted.
      vi.advanceTimersByTime(LOCKOUT_SEC * 1000 + 1);

      // THE regression. Pre-fix this returned 4 and re-locked immediately, so
      // every subsequent typo cost another five minutes, forever.
      expect(store().recordFailure(MAX_ATTEMPTS, LOCKOUT_SEC)).toBe(1);
      expect(store().attempts).toBe(1);
      expect(store().lockoutUntil).toBeNull();
      expect(secondsUntil(store().lockoutUntil)).toBe(0);
    });

    it('gives a full fresh set of attempts, not just one', () => {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        store().recordFailure(MAX_ATTEMPTS, LOCKOUT_SEC);
      }
      vi.advanceTimersByTime(LOCKOUT_SEC * 1000 + 1);

      expect(store().recordFailure(MAX_ATTEMPTS, LOCKOUT_SEC)).toBe(1);
      expect(store().lockoutUntil).toBeNull();
      expect(store().recordFailure(MAX_ATTEMPTS, LOCKOUT_SEC)).toBe(2);
      expect(store().lockoutUntil).toBeNull();
      // Only the third one locks again.
      expect(store().recordFailure(MAX_ATTEMPTS, LOCKOUT_SEC)).toBe(3);
      expect(store().lockoutUntil).toBe(Date.now() + LOCKOUT_SEC * 1000);
    });

    it('does not reset one second short of the deadline', () => {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        store().recordFailure(MAX_ATTEMPTS, LOCKOUT_SEC);
      }

      vi.advanceTimersByTime(LOCKOUT_SEC * 1000 - 1000);

      // The boundary in the other direction: an unserved lockout still counts
      // on from the previous total, so the reset above is genuinely keyed on
      // the deadline having passed and not on "any later call".
      //
      // This also restarts the lockout clock, which is why `useOTP.verifyOTP`
      // returns early while `isLockedOut` — the store is not the thing keeping
      // a locked-out user from spending attempts, the screen is.
      expect(store().recordFailure(MAX_ATTEMPTS, LOCKOUT_SEC)).toBe(MAX_ATTEMPTS + 1);
      expect(secondsUntil(store().lockoutUntil)).toBe(LOCKOUT_SEC);
    });

    it('resets exactly at the deadline, not a second after it', () => {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        store().recordFailure(MAX_ATTEMPTS, LOCKOUT_SEC);
      }

      // `lockoutUntil <= Date.now()` — the deadline itself counts as served.
      vi.advanceTimersByTime(LOCKOUT_SEC * 1000);

      expect(store().recordFailure(MAX_ATTEMPTS, LOCKOUT_SEC)).toBe(1);
    });
  });

  describe('clearExpired', () => {
    it('drops an expired lockout and the attempt count with it', () => {
      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        store().recordFailure(MAX_ATTEMPTS, LOCKOUT_SEC);
      }

      vi.advanceTimersByTime(LOCKOUT_SEC * 1000);
      store().clearExpired();

      expect(store().lockoutUntil).toBeNull();
      expect(store().attempts).toBe(0);
    });

    it('drops an expired resend cooldown', () => {
      store().startResendCooldown(RESEND_SEC);
      expect(secondsUntil(store().resendCooldownUntil)).toBe(RESEND_SEC);

      vi.advanceTimersByTime(RESEND_SEC * 1000);
      store().clearExpired();

      expect(store().resendCooldownUntil).toBeNull();
    });

    it('leaves deadlines that have not passed alone', () => {
      store().recordFailure(MAX_ATTEMPTS, LOCKOUT_SEC);
      store().startResendCooldown(RESEND_SEC);
      const cooldown = store().resendCooldownUntil;

      vi.advanceTimersByTime(30_000);
      store().clearExpired();

      expect(store().attempts).toBe(1);
      expect(store().resendCooldownUntil).toBe(cooldown);
      expect(secondsUntil(store().resendCooldownUntil)).toBe(30);
    });

    it('does not publish a new state object when nothing expired', () => {
      // `useOTP` calls this once a second while a deadline is active. Writing
      // unconditionally would re-render every subscriber on every tick.
      store().startResendCooldown(RESEND_SEC);
      const before = useOtpThrottleStore.getState();

      vi.advanceTimersByTime(1000);
      store().clearExpired();

      expect(useOtpThrottleStore.getState()).toBe(before);
    });

    it('is safe to call on a clean store', () => {
      const before = useOtpThrottleStore.getState();
      store().clearExpired();
      expect(useOtpThrottleStore.getState()).toBe(before);
    });
  });

  describe('the resend cooldown is shared, not per-screen', () => {
    it('is visible from a second import of the module', async () => {
      // The shape of the original bug: login started the cooldown and
      // verify-otp read zero, because each `useOTP` call had its own state.
      // Holding it at module scope is what makes the two screens agree, so
      // that is what this pins — a second import must hand back the same
      // store, not a fresh one.
      const login = await import('@/features/auth/stores/otpThrottleStore');
      const verify = await import('@/features/auth/stores/otpThrottleStore');
      expect(login.useOtpThrottleStore).toBe(verify.useOtpThrottleStore);

      login.useOtpThrottleStore.getState().startResendCooldown(RESEND_SEC);

      // What verify-otp would render on arrival: 60, not 0.
      expect(
        secondsUntil(verify.useOtpThrottleStore.getState().resendCooldownUntil),
      ).toBe(RESEND_SEC);
    });

    it('carries the lockout across screens too', async () => {
      const login = await import('@/features/auth/stores/otpThrottleStore');
      const verify = await import('@/features/auth/stores/otpThrottleStore');

      for (let i = 0; i < MAX_ATTEMPTS; i++) {
        verify.useOtpThrottleStore.getState().recordFailure(MAX_ATTEMPTS, LOCKOUT_SEC);
      }

      // Navigating back to login must not hand the user a clean slate.
      expect(login.useOtpThrottleStore.getState().attempts).toBe(MAX_ATTEMPTS);
      expect(
        secondsUntil(login.useOtpThrottleStore.getState().lockoutUntil),
      ).toBe(LOCKOUT_SEC);
    });
  });

  describe('reset', () => {
    it('clears everything on a successful verification', () => {
      store().recordFailure(MAX_ATTEMPTS, LOCKOUT_SEC);
      store().startResendCooldown(RESEND_SEC);

      store().reset();

      expect(store().attempts).toBe(0);
      expect(store().lockoutUntil).toBeNull();
      expect(store().resendCooldownUntil).toBeNull();
    });
  });
});

describe('secondsUntil', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T09:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is 0 for no deadline', () => {
    expect(secondsUntil(null)).toBe(0);
  });

  it('is 0 for a deadline already passed, never negative', () => {
    // A negative would render as "Resend in -12s" and, worse, compare as
    // falsy-adjacent in the screens' `> 0` guards.
    expect(secondsUntil(Date.now() - 1)).toBe(0);
    expect(secondsUntil(Date.now() - 60_000)).toBe(0);
  });

  it('rounds up, so a partial second still reads as a second remaining', () => {
    expect(secondsUntil(Date.now() + 1)).toBe(1);
    expect(secondsUntil(Date.now() + 1500)).toBe(2);
    expect(secondsUntil(Date.now() + 60_000)).toBe(60);
  });
});
