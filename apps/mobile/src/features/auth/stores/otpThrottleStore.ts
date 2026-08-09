import { create } from 'zustand';

/**
 * OTP attempt and cooldown state, shared across screens.
 *
 * This deliberately does not live in `useOTP`. Login and verify-otp each call
 * that hook, creating two independent instances, and the state that is supposed
 * to throttle the user lived in one of them:
 *
 * - `sendOTP` started the 60s cooldown in *login's* instance. The user then
 *   navigated to verify-otp, whose instance had a countdown of zero, so
 *   "Resend Code" was enabled the moment they arrived — and tapping it hit
 *   Supabase's own limit and showed a security warning on a screen they had
 *   just landed on.
 * - Five wrong codes locked the user out. Tapping back and sending again gave
 *   them a fresh instance with `otpAttempts` at zero, so the lockout was
 *   decorative.
 *
 * Timestamps rather than countdowns: the remaining seconds are derived on
 * demand, so the values stay correct across unmounts and while the app is
 * backgrounded, with no interval left running to keep them honest.
 */
interface OtpThrottleState {
  /** Consecutive failed verification attempts. */
  attempts: number;
  /** Epoch ms until which verification is locked out, or null. */
  lockoutUntil: number | null;
  /** Epoch ms until which resending is on cooldown, or null. */
  resendCooldownUntil: number | null;

  recordFailure: (maxAttempts: number, lockoutSeconds: number) => number;
  startResendCooldown: (seconds: number) => void;
  /**
   * Null out any deadline that has already passed (and, with the lockout, the
   * attempt count it belongs to). Safe to call on a timer: it only writes when
   * something actually expired.
   */
  clearExpired: () => void;
  /** Clear everything — call on a successful verification. */
  reset: () => void;
}

export const useOtpThrottleStore = create<OtpThrottleState>((set, get) => ({
  attempts: 0,
  lockoutUntil: null,
  resendCooldownUntil: null,

  recordFailure: (maxAttempts, lockoutSeconds) => {
    const { attempts: previous, lockoutUntil } = get();

    // Serving the lockout is what buys the user their attempts back. Counting
    // on from the old total instead turned one lockout into a permanent
    // one-strike lockout: `attempts` stayed at the maximum, the screen showed
    // "0 attempts remaining", and the next single wrong digit tripped
    // `attempts >= maxAttempts` again for another full-length lockout.
    //
    // Checked here as well as in `clearExpired` so the reset does not depend on
    // a ticker having been mounted while the lockout ran out.
    const served = lockoutUntil !== null && lockoutUntil <= Date.now();
    const attempts = (served ? 0 : previous) + 1;
    const locked = attempts >= maxAttempts;

    set({
      attempts,
      lockoutUntil: locked
        ? Date.now() + lockoutSeconds * 1000
        : served
          ? null
          : lockoutUntil,
    });
    return attempts;
  },

  startResendCooldown: (seconds) => {
    set({ resendCooldownUntil: Date.now() + seconds * 1000 });
  },

  clearExpired: () => {
    const now = Date.now();
    const { attempts, lockoutUntil, resendCooldownUntil } = get();
    const patch: Partial<OtpThrottleState> = {};

    if (lockoutUntil !== null && lockoutUntil <= now) {
      patch.lockoutUntil = null;
      if (attempts > 0) patch.attempts = 0;
    }

    if (resendCooldownUntil !== null && resendCooldownUntil <= now) {
      patch.resendCooldownUntil = null;
    }

    // Nothing expired — return without writing, so a per-second caller does not
    // publish a new store object every tick.
    if (Object.keys(patch).length === 0) return;

    set(patch);
  },

  reset: () => set({ attempts: 0, lockoutUntil: null, resendCooldownUntil: null }),
}));

/** Seconds remaining until `deadline`, or 0. */
export function secondsUntil(deadline: number | null): number {
  if (deadline === null) return 0;
  return Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
}
