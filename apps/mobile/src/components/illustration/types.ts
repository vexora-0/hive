/**
 * The shared contract for Hive's spot illustrations.
 *
 * These four constants are the whole specification. They live in code rather
 * than in a comment because the previous accent hierarchy proved that a rule
 * written in prose drifts within a release: the next person adds an eighth
 * drawing, guesses at the grid, and the set stops looking like one hand drew
 * it. Import them; do not retype the numbers.
 *
 * The one rule that cannot be expressed as a constant, so it is written here
 * instead: **the subjects are objects and places, never people.** A drawn child
 * is competing with a photograph of a real one on the very next screen, and it
 * loses every time.
 */

import type { StyleProp, ViewStyle } from 'react-native';

import { colors } from '@/theme';

/**
 * The grid every spot illustration is drawn on.
 *
 * Icons live on a 24 grid at `strokeWidth={2}`. Scaling one of those to 120pt
 * would render a 10pt stroke — a blob — so illustrations get their own,
 * five-times-larger grid and are drawn at 2.5. At the rendered size the two
 * families then read as the same weight of line, which is the entire point:
 * one hand, two scales.
 */
export const ILLUSTRATION_VIEW_BOX = '0 0 120 120';

/** Stroke weight on the 120 grid. See {@link ILLUSTRATION_VIEW_BOX}. */
export const ILLUSTRATION_STROKE_WIDTH = 2.5;

/**
 * Rendered size in points. The brief's band is 120–140; 128 sits in the middle
 * of it and is a whole number of the 120 grid's units plus a little, so nothing
 * lands on a half pixel at 1×, 2× or 3×.
 */
export const DEFAULT_ILLUSTRATION_SIZE = 128;

/**
 * The single ink, and the only colour any of these draw in unless the caller
 * says otherwise. Exported so a drawing that needs to paint an area — the
 * level inside `HoneycombCell` — can tint the same ink instead of guessing at
 * a second value that would drift from the canvas's default.
 */
export const DEFAULT_ILLUSTRATION_COLOR = colors.ink[900];

/**
 * Opacity of the optional marigold layer.
 *
 * Marigold is 2.03:1 on paper — a surface, never a label — so it may sit behind
 * the line but may never *be* the line. At 30% it is a warmth behind the
 * drawing rather than a second colour competing with it.
 */
export const WASH_OPACITY = 0.3;

/**
 * Props shared by all seven illustrations.
 *
 * Deliberately small. An illustration has no state, no interaction and no
 * accessible name — the copy beside it carries the meaning — so there is
 * nothing else to configure.
 */
export interface IllustrationProps {
  /** Rendered width and height in points. @default 128 */
  size?: number;
  /**
   * The single ink the drawing is made in. `ink.900` on paper; pass
   * `colors.text.onInk` on a dark surface. There is never a second colour.
   * @default colors.ink[900]
   */
  color?: string;
  /**
   * Paints one marigold shape at 30% opacity behind the line — the sky beyond
   * a window, the missing photograph in a mount. Off by default: most empty
   * states want the drawing to recede, not to be a feature.
   * @default false
   */
  wash?: boolean;
  /** Optional container style — margins and alignment belong to the caller. */
  style?: StyleProp<ViewStyle>;
}
