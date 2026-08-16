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
 *    cover — autoplaying loops, parallax.
 *  - **Springs move things; timings colour them.** `withSpring` on `opacity` or
 *    a colour clamps at 1.0 whenever ζ < 1 and visibly stalls at the end of the
 *    run. That is a bug class, not a style preference — use `withTiming` for
 *    anything that is not a transform.
 *
 * ── The vocabulary is damping ratio (ζ) ──────────────────────────────
 *
 * ζ = damping / (2 × √(stiffness × mass)). It is the only figure that carries
 * between Material's published tokens, Reanimated's `{duration, dampingRatio}`
 * form and a conversation with a designer, so every spring below is documented
 * by its ratio and its settling time rather than by three raw numbers.
 *
 *  - **ζ 0.85–1.0** — settles once, no visible wobble.
 *  - **ζ 0.7–0.85** — one faint overshoot. **This is the house register.**
 *  - **ζ ≤ 0.6** — a toy. Forbidden on anything that travels further than a
 *    press, where the overshoot reads as imprecision rather than as life.
 *
 * **Ceiling: 400ms for anything the user waits through. 500ms is a failure.**
 * Budget by frequency — a tab switch or a photo tap happens many times a day
 * and gets ≤200ms; placing an order happens weekly and earns one crafted
 * 300–400ms moment.
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
  /**
   * Press feedback. **ζ = 0.57, ~270ms, 11.5% overshoot.**
   *
   * That ratio is below the house floor and the comment here used to claim "no
   * overshoot", which was simply wrong. It is kept because at the distance a
   * press actually travels — a scale of 1 → 0.96 — 5% of 4% is invisible, and
   * the low ratio is what makes it feel immediate under the finger. **Do not
   * reuse it for anything that moves further**, where the same config is
   * visibly springy.
   */
  press: {
    damping: 18,
    stiffness: 420,
    mass: 0.6,
    reduceMotion: ReduceMotion.System,
  },
  /** The default for anything moving into place. **ζ = 0.74, ~380ms.** */
  gentle: {
    damping: 21,
    stiffness: 200,
    mass: 1,
    reduceMotion: ReduceMotion.System,
  },
  /**
   * Selection changes — the tab puck, segmented controls, chips.
   * **ζ = 0.91, ~220ms.**
   *
   * Was ζ = 0.69. At one tab-width of travel that overshoot read as the puck
   * missing its mark and coming back, which is what three separate alignment
   * fixes were chasing. It now arrives under the destination icon and stops.
   * Animate **x only** — animating width at the same time is what clipped the
   * first and last labels.
   */
  snappy: {
    damping: 29,
    stiffness: 320,
    mass: 0.8,
    reduceMotion: ReduceMotion.System,
  },
  /**
   * The one place a little life is allowed: a total updating, an order landing.
   * **ζ = 0.65, ~380ms.**
   *
   * Was ζ = 0.39 with 26% overshoot and a 655ms settle — toy physics, and past
   * the point where a delay stops reading as character and starts reading as
   * lag.
   */
  bouncy: {
    damping: 19,
    stiffness: 236,
    mass: 0.9,
    reduceMotion: ReduceMotion.System,
  },
  /** Sheets and large panels — heavy, settles without a wobble. **ζ = 0.87, ~290ms.** */
  sheet: {
    damping: 28,
    stiffness: 260,
    mass: 1,
    reduceMotion: ReduceMotion.System,
  },
  /**
   * **The mascot's spring.** ζ = 0.42, ~430ms, ~23% overshoot.
   *
   * This is below the ζ 0.6 floor the header sets, deliberately and with a
   * boundary. That floor exists because a *control* that overshoots reads as
   * imprecise — a puck that misses its tab, a sheet that bounces past its
   * detent. Neither of those is a character. A bee landing is supposed to
   * overshoot; a bee that arrives with ζ 0.87 is a rectangle with wings, which
   * is precisely the diagnosis this whole revamp is answering.
   *
   * **Permitted only on `components/mascot/**` and `components/decor/**`, and
   * only on transforms of something that is drawn rather than tapped.** If it
   * is under a finger or a person is waiting on it, it takes `press`, `snappy`
   * or `gentle` like everything else.
   */
  alive: {
    damping: 8,
    stiffness: 180,
    mass: 0.9,
    reduceMotion: ReduceMotion.System,
  },
  /**
   * Squish — the toy-key press, for playful controls. **ζ = 0.5, ~250ms.**
   *
   * `press` (ζ 0.57) at a scale of 1 → 0.96 hides its overshoot because the
   * travel is 4%. This one is for controls that travel 8–12% and *should* be
   * seen springing back: the mascot, the celebration button, a sticker card.
   */
  squish: {
    damping: 14,
    stiffness: 500,
    mass: 0.8,
    reduceMotion: ReduceMotion.System,
  },
} as const satisfies Record<string, WithSpringConfig>;

// ── Ambient loops ────────────────────────────────────────────────────
//
// Periods, not durations. Everything below runs unattended and forever, so it
// is described by how long one cycle takes rather than by how long a user
// waits — nobody waits for these. **Every one of them must be skipped when
// `useReducedMotion()` is true**: a config flag cannot help a `loop` prop, and
// an endlessly moving background is the single most common accessibility
// failure in a design like this one.

export const ambient = {
  /** 260ms — a wingbeat. Fast enough to blur, slow enough to see. */
  wing: 260,
  /** 2600ms — the hover bob a resting character never stops doing. */
  bob: 2600,
  /** 4200ms — a pollen mote crossing the screen. */
  drift: 4200,
  /** 7000ms — the slow breath of a background wash. */
  breathe: 7000,
  /** 1400ms — a sparkle twinkling on and off. */
  twinkle: 1400,
} as const;

/**
 * Spreads an ambient loop across N instances so they never beat in unison.
 *
 * Twelve pollen motes all rising on the same 4.2s cycle read as a progress
 * bar. Offsetting each by an irrational-ish fraction of the period is what
 * turns the same twelve into weather. The 0.618 is the golden ratio's
 * fractional part, chosen because successive multiples of it mod 1 spread more
 * evenly than any rational step — the same reason it is used for hue
 * assignment in palette generators.
 */
export function phase(index: number, period: number): number {
  return Math.round(((index * 0.618) % 1) * period);
}

// ── Durations ────────────────────────────────────────────────────────

export const duration = {
  /** 120ms — colour and opacity swaps that should feel instantaneous. */
  instant: 120,
  /** 180ms — hover/focus rings, small crossfades. */
  fast: 180,
  /** 260ms — the default. */
  base: 260,
  /** 380ms — entrances, screen-level reveals. Inside the 400ms ceiling. */
  slow: 380,
  /**
   * 200ms — **the exit.**
   *
   * Exits used to inherit entrance timings, which is why dismissing anything
   * felt sticky: leaving should be quicker than arriving, because the user has
   * already decided. Pair with `easing.accelerate`.
   *
   * Never carry meaning in an exit — Reduce Motion *omits* exit animations
   * rather than shortening them, so anything only an exit communicates is
   * invisible to the users who most need it stated.
   */
  exit: 200,
  /**
   * 650ms — the one deliberate moment.
   *
   * **Off the user's path only**: an ambient flourish they are not waiting on.
   * Never an entrance, a transition, or anything between a tap and its result.
   */
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

/**
 * The matching exit — quicker than the entrance, and accelerating out.
 *
 * ```ts
 * opacity.value = withTiming(0, exitTiming());
 * ```
 */
export function exitTiming(
  ms: number = duration.exit,
  curve = easing.accelerate,
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
  /** Playful controls that should be seen to squash. Pair with `spring.squish`. */
  toy: 0.9,
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
  exitTiming,
  stagger,
  pressScale,
  travel,
  ambient,
  phase,
  STAGGER_STEP,
} as const;

export type Motion = typeof motion;
