import React from 'react';
import { Polygon } from 'react-native-svg';

import { toPoints, type Point } from './geometry';
import { IllustrationCanvas } from './IllustrationCanvas';
import { DEFAULT_ILLUSTRATION_COLOR, type IllustrationProps } from './types';

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

const CX = 60;
const CY = 60;
const R = 42;

/** Half the cell's height. A flat-top hexagon is √3/2 as tall as it is wide. */
const HALF_HEIGHT = (R * Math.sqrt(3)) / 2;
const TOP = CY - HALF_HEIGHT;
const BOTTOM = CY + HALF_HEIGHT;

/** Opacity of the rising level. See the note on the component. */
const LEVEL_OPACITY = 0.2;

/**
 * A flat-top cell — flat top and bottom, points at left and right — because
 * that is how cells actually tile in a comb, and it matches `HiveMark`. The
 * two marks appear on the same screens often enough that a pointy-top cell
 * here would look like a different hive.
 */
function cellPoints(): string {
  const pts: Point[] = [];
  for (let i = 0; i < 6; i++) {
    const radians = (Math.PI / 180) * (60 * i);
    pts.push([CX + R * Math.cos(radians), CY + R * Math.sin(radians)]);
  }
  return toPoints(pts);
}

const CELL = cellPoints();

/** Half-width of the cell at height `y`: `R` at the middle, `R/2` at the flats. */
function halfWidthAt(y: number): number {
  return R - (R / 2) * (Math.abs(y - CY) / HALF_HEIGHT);
}

/**
 * The filled part of the cell, cut by a horizontal line whose height is set by
 * `progress`.
 *
 * Computed as a polygon rather than clipped with a `<ClipPath>`. A clip path
 * needs an id, ids must be unique across every instance on screen, and
 * `useId`'s output contains colons that are not safe inside a `url(#…)`
 * reference — a pull-to-refresh indicator is exactly the component likely to
 * be mounted twice at once, so the whole class of bug is avoided by not
 * needing an id at all. The maths is six points of trigonometry and is cheap
 * enough to run on every frame of a pull.
 */
function levelPoints(progress: number): string | null {
  const filled = Math.min(1, Math.max(0, progress));
  if (filled <= 0) return null;

  const line = BOTTOM - (BOTTOM - TOP) * filled;
  const halfWidth = halfWidthAt(line);
  const pts: Point[] = [[CX - halfWidth, line]];

  // Past the halfway mark the level has cleared the cell's widest points, so
  // the left and right vertices join the outline.
  if (line < CY) pts.push([CX - R, CY]);
  pts.push([CX - R / 2, BOTTOM], [CX + R / 2, BOTTOM]);
  if (line < CY) pts.push([CX + R, CY]);
  pts.push([CX + halfWidth, line]);

  return toPoints(pts);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HoneycombCellProps extends IllustrationProps {
  /**
   * How full the cell is, 0 to 1. Values outside the range are clamped, so a
   * caller may hand over raw pull distance divided by a threshold without
   * guarding the overscroll.
   * @default 0
   */
  progress?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<HoneycombCell>` — one comb cell that fills as it is pulled.
 *
 * For pull-to-refresh. The brief asks for an indicator driven by pull distance
 * rather than by time, because a spinner that starts before the finger lifts
 * is announcing a request that has not been made yet. Filling a cell answers
 * "how much further?" honestly, and it is the app's own mark rather than a
 * borrowed system spinner.
 *
 * `progress` is a plain number, not a Reanimated `SharedValue`: this has to be
 * usable from a `ScrollView`'s scroll position with three lines at the call
 * site, and a component that demands a worklet gets reimplemented as a spinner
 * instead.
 *
 * The level is painted in the same ink at {@link LEVEL_OPACITY} — a tint of
 * the one colour, never a second one — so the outline stays the strongest mark
 * on the shape at every value of `progress`.
 *
 * ```tsx
 * <HoneycombCell progress={pullDistance / REFRESH_THRESHOLD} size={72} />
 * ```
 */
export function HoneycombCell({
  progress = 0,
  color = DEFAULT_ILLUSTRATION_COLOR,
  ...props
}: HoneycombCellProps) {
  const level = levelPoints(progress);

  return (
    <IllustrationCanvas
      {...props}
      color={color}
      washShape={<Polygon points={CELL} />}
    >
      {level ? (
        <Polygon
          points={level}
          fill={color}
          stroke="none"
          opacity={LEVEL_OPACITY}
        />
      ) : null}
      <Polygon points={CELL} />
    </IllustrationCanvas>
  );
}

export default HoneycombCell;
