/**
 * Hive spot illustrations — the specification, and the seven drawings that
 * follow it.
 *
 * ## The spec
 *
 * | Rule | Value |
 * |---|---|
 * | Grid | `viewBox="0 0 120 120"` |
 * | Stroke | `2.5`, round cap, round join, `fill="none"` |
 * | Rendered at | 120–140pt · default 128 |
 * | Colour | **one ink.** `ink.900` on paper, `text.onInk` on a dark surface |
 * | Optional | **one** marigold shape at 30% behind the line, off by default |
 * | Subject | objects and places — **never people** |
 * | Accessibility | decorative; hidden from screen readers on both platforms |
 *
 * **Why the 120 grid.** Icons are drawn on a 24 grid at `strokeWidth={2}`.
 * Scaling one of those up to 120pt renders a 10pt stroke — a blob. Five times
 * the grid at 2.5 gives the same apparent weight at the size these are used,
 * which is what makes the icons and the illustrations read as one hand.
 *
 * **Why no people.** Every one of these appears within a swipe of a photograph
 * of a real child. A drawn child, a mascot or an avatar figure is competing
 * with that photograph and always loses — and the moment one exists, the app
 * has two visual answers to the question "who is this about". Objects and
 * places do not compete: a mount, a plane, a stack of prints, a schoolhouse, a
 * window, a magnifier, a comb cell.
 *
 * **Why one colour.** Marigold is 2.03:1 on paper. It is a surface and never a
 * label, so it may lie behind the line but may never be the line, and nothing
 * else in the palette is allowed into a drawing at all. A two-colour
 * illustration is the single most dating device in this category — see the
 * brief on Brightwheel's twelve-colour tile grid.
 *
 * **Where they go.** The three empty states, onboarding confirmation,
 * pull-to-refresh, full-screen errors. **One per screen, maximum**, and never
 * on a screen that also shows a photograph.
 *
 * Do not add an eighth drawing by copying the numbers out of one of these.
 * Build it on {@link IllustrationCanvas}, which applies all of the above, and
 * the eighth will still belong to the set in a year.
 *
 * ```tsx
 * import { EmptyAlbum } from '@/components/illustration';
 *
 * <EmptyAlbum />                                  // on paper
 * <OpenWindow color={colors.text.onInk} wash />   // on an ink surface
 * ```
 *
 * @see docs/design/UI-REVAMP-BRIEF.md §6
 */

export { EmptyAlbum } from './EmptyAlbum';
export { PaperPlane } from './PaperPlane';
export { SchoolGate } from './SchoolGate';
export { StackOfPrints } from './StackOfPrints';
export { OpenWindow } from './OpenWindow';
export { SearchGlass } from './SearchGlass';
export { HoneycombCell } from './HoneycombCell';
export type { HoneycombCellProps } from './HoneycombCell';

export { IllustrationCanvas } from './IllustrationCanvas';
export type { IllustrationCanvasProps } from './IllustrationCanvas';

export type { IllustrationProps } from './types';
export {
  DEFAULT_ILLUSTRATION_COLOR,
  DEFAULT_ILLUSTRATION_SIZE,
  ILLUSTRATION_STROKE_WIDTH,
  ILLUSTRATION_VIEW_BOX,
  WASH_OPACITY,
} from './types';
