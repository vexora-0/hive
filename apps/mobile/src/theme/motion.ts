/**
 * Hive Motion
 *
 * Every animation in the app is built from the values in this file, so that
 * two different screens pressing a button feel like the same app.
 *
 * The rules:
 *
 *  - **Springs for anything the finger caused**, timing curves for anything
 *    the app decided. A press, a drag, a sheet following a gesture should
 *    behave like a physical object; a toast appearing on its own should not
 *    overshoot.
 *  - **One orchestrated entrance per screen**, not an effect on every element.
 *    `stagger()` exists so a list arrives as one gesture rather than as
 *    fifteen independent ones, and it caps out — past the eighth row nobody is
 *    watching the choreography, they are waiting for it to finish.
 *  - **Reduce Motion is respected by construction.** Every spring and timing
 *    config below carries `reduceMotion: ReduceMotion.System`, so an animation
 *    built from these values already does the right thing on a device where
 *    the setting is on. Use `useReducedMotion()` for the cases config cannot
 *    cover — autoplaying loops, parallax, confetti.
 */

import {
  Easing,
  ReduceMotion,
  useReducedMotion as useReanimatedReducedMotion,
  type WithSpringConfig,
  type WithTimingConfig,
} from 'react-native-reanimated';

// ── Springs ──────────────────────────────────────────────────────────

export const spring = {
  /** Press feedback — fast, no overshoot. The finger is still on the glass. */
  press: {
    damping: 18,
    stiffness: 420,
    mass: 0.6,
    reduceMotion: ReduceMotion.System,
  },
  /** The default for anything moving into place. */
  gentle: {
    damping: 20,
    stiffness: 180,
    mass: 1,
    reduceMotion: ReduceMotion.System,
  },
  /** Selection changes — tab pills, segmented controls, chips. */
  snappy: {
    damping: 22,
    stiffness: 320,
    mass: 0.8,
    reduceMotion: ReduceMotion.System,
  },
  /** Reserved for celebration: a total updating, an order landing. */
  bouncy: {
    damping: 11,
    stiffness: 220,
    mass: 0.9,
    reduceMotion: ReduceMotion.System,
  },
  /** Sheets and large panels — heavy, settles without a wobble. */
  sheet: {
    damping: 28,
    stiffness: 260,
    mass: 1,
    reduceMotion: ReduceMotion.System,
  },
} as const satisfies Record<string, WithSpringConfig>;

// ── Durations ────────────────────────────────────────────────────────

export const duration = {
  /** 120ms — colour and opacity swaps that should feel instantaneous. */
  instant: 120,
  /** 180ms — hover/focus rings, small crossfades. */
  fast: 180,
  /** 260ms — the default. */
  base: 260,
  /** 420ms — entrances, screen-level reveals. */
  slow: 420,
  /** 650ms — the one deliberate moment on a screen. */
  deliberate: 650,
} as const;

// ── Easing ───────────────────────────────────────────────────────────

export const easing = {
  /** The house curve: quick to leave, long to arrive. */
  standard: Easing.bezier(0.32, 0.72, 0, 1),
  /** Entering the screen. */
  decelerate: Easing.out(Easing.cubic),
  /** Leaving the screen. */
  accelerate: Easing.in(Easing.cubic),
  /** Continuous loops — shimmer, pulse. */
  linear: Easing.linear,
} as const;

/** A timing config built from the house curve. */
export function timing(
  ms: number = duration.base,
  curve = easing.standard,
): WithTimingConfig {
  return { duration: ms, easing: curve, reduceMotion: ReduceMotion.System };
}

// ── Choreography ─────────────────────────────────────────────────────

/** How long each item in a staggered group waits before the next one starts. */
export const STAGGER_STEP = 45;

/**
 * Delay for the nth item of a staggered entrance, in milliseconds.
 *
 * Capped at `cap` items so a long list does not make the last row wait a
 * second and a half to appear.
 */
export function stagger(
  index: number,
  step: number = STAGGER_STEP,
  cap = 8,
): number {
  return Math.min(index, cap) * step;
}

// ── Press physics ────────────────────────────────────────────────────

/** How far a control shrinks under a finger. Buttons move more than cards. */
export const pressScale = {
  button: 0.96,
  card: 0.985,
  /** Icon-only controls, which need a bigger move to register at their size. */
  icon: 0.9,
} as const;

/** Distance an entering element travels before settling, in px. */
export const travel = {
  /** List rows and cards rising into place. */
  rise: 14,
  /** Screen-level sections. */
  section: 24,
} as const;

// ── Reduce Motion ────────────────────────────────────────────────────

/**
 * True when the device has Reduce Motion turned on.
 *
 * The configs above already handle springs and timings. Reach for this hook
 * when an animation has no config to carry the flag — a looping shimmer, a
 * parallax offset, confetti — and skip the effect entirely.
 */
export function useReducedMotion(): boolean {
  return useReanimatedReducedMotion();
}

export const motion = {
  spring,
  duration,
  easing,
  timing,
  stagger,
  pressScale,
  travel,
  STAGGER_STEP,
} as const;

export type Motion = typeof motion;
