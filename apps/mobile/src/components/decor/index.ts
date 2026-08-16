/**
 * Decor — the app's weather and its marginalia.
 *
 * Two families, and the distinction matters:
 *
 *  - **Atmosphere** (`PlayfulBackdrop` and its three layers) sits *behind*
 *    everything, is never interacted with, and is tuned so low that you should
 *    have to look for it. Its job is to stop a full-bleed cream page reading as
 *    an unstyled `<View>`.
 *  - **Marks** (`Doodle`, `Confetti`) sit *among* content. They are the
 *    squiggle under a greeting, the sparkle beside a badge, the burst when an
 *    order lands.
 *
 * Neither ever carries meaning. Delete any of it and the screen must still say
 * everything it said before — which is also why every component in here is
 * hidden from screen readers and skipped under Reduce Motion.
 *
 * ```tsx
 * import { PlayfulBackdrop, Doodle, Confetti } from '@/components/decor';
 * ```
 */

export { PlayfulBackdrop } from './PlayfulBackdrop';
export type { PlayfulBackdropProps, BackdropLevel } from './PlayfulBackdrop';

export { SunGlow, glowTint } from './SunGlow';
export type { SunGlowProps } from './SunGlow';

export { CombField } from './CombField';
export type { CombFieldProps } from './CombField';

export { PollenDrift } from './PollenDrift';
export type { PollenDriftProps } from './PollenDrift';

export { Doodle, doodleHeight } from './Doodle';
export type { DoodleProps, DoodleKind } from './Doodle';

export { Scene } from './Scene';
export type { SceneProps, SceneKind } from './Scene';

export { Confetti } from './Confetti';
export type { ConfettiProps } from './Confetti';
