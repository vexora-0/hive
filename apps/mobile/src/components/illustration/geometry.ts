/**
 * Geometry shared by the drawings that sit at an angle.
 *
 * Three of the seven illustrations are built from tilted rectangles — a mount,
 * a fanned stack, a print under a glass — and a tilt is the cheapest way to
 * stop a rectangle looking like a UI element and start it looking like a thing
 * lying on a table.
 *
 * The corners are computed here rather than handed to SVG as a transform for
 * two reasons. `rotation` and `origin` are both marked `@deprecated` in the
 * installed react-native-svg typings, and a transform hides the drawing's real
 * extents from whoever next tries to keep it inside the 120 grid. Computed
 * points can be read straight off the element. `HiveMark` builds its hexagon
 * the same way, so this is also the house habit.
 */

/** An `[x, y]` pair on the 120 grid. */
export type Point = readonly [number, number];

/** Formats points for an SVG `points` attribute. */
export function toPoints(pts: readonly Point[]): string {
  return pts.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
}

/** Formats points as an SVG path — `closed` adds the final `Z`. */
export function toPath(pts: readonly Point[], closed = false): string {
  const body = pts
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`)
    .join(' ');
  return closed ? `${body} Z` : body;
}

/** Rotates one point `angle` degrees clockwise about (`cx`, `cy`). */
export function rotate(
  x: number,
  y: number,
  angle: number,
  cx: number,
  cy: number,
): Point {
  const radians = (Math.PI / 180) * angle;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const dx = x - cx;
  const dy = y - cy;
  return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
}

/**
 * The four corners of a rectangle, rotated `angle` degrees about a pivot.
 *
 * The pivot defaults to the rectangle's own centre, which is what a single
 * tilted object wants. A fanned stack instead passes a pivot *below* the
 * prints, so each print swings sideways as it turns — rotating each card about
 * its own centre gives a pinwheel, not a stack.
 */
export function rotatedRect(
  x: number,
  y: number,
  width: number,
  height: number,
  angle: number,
  pivotX: number = x + width / 2,
  pivotY: number = y + height / 2,
): Point[] {
  return (
    [
      [x, y],
      [x + width, y],
      [x + width, y + height],
      [x, y + height],
    ] as const
  ).map(([px, py]) => rotate(px, py, angle, pivotX, pivotY));
}
