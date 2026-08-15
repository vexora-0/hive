import React from 'react';
import { Circle, Line, Polygon } from 'react-native-svg';

import { rotatedRect, toPoints } from './geometry';
import { IllustrationCanvas } from './IllustrationCanvas';
import type { IllustrationProps } from './types';

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

const TILT = -4;
const MOUNT = toPoints(rotatedRect(16, 18, 62, 72, TILT, 47, 54));
const APERTURE = toPoints(rotatedRect(25, 27, 44, 44, TILT, 47, 54));

/**
 * The glass sits over the mount's lower corner rather than beside it. A
 * magnifier floating next to a print is two objects; a magnifier overlapping
 * one is a search. The lines simply cross where they meet — at 2.5 on a 120
 * grid a crossing reads as glass over paper, and knocking the paper out would
 * mean filling the lens with the ground colour, which this language does not
 * have.
 */
const LENS = { cx: 80, cy: 78, r: 22 } as const;

/** Leaves the rim on the 45° diagonal, so the handle continues the circle. */
const HANDLE_START = LENS.r * Math.SQRT1_2;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<SearchGlass>` — a magnifier over an empty mount.
 *
 * For "nothing matched that filter", and only for that. The brief asks for
 * three distinct empty states because they need three distinct answers: this
 * one has a way out — clear the filter — where a first-use empty state has
 * none. Using this drawing for "no photos yet" would quietly promise a parent
 * that something is hidden and findable.
 *
 * ```tsx
 * <SearchGlass />
 * ```
 */
export function SearchGlass(props: IllustrationProps) {
  return (
    <IllustrationCanvas
      {...props}
      washShape={<Circle cx={LENS.cx} cy={LENS.cy} r={LENS.r} />}
    >
      <Polygon points={MOUNT} />
      <Polygon points={APERTURE} />
      <Circle cx={LENS.cx} cy={LENS.cy} r={LENS.r} />
      <Line
        x1={LENS.cx + HANDLE_START}
        y1={LENS.cy + HANDLE_START}
        x2={110}
        y2={108}
      />
    </IllustrationCanvas>
  );
}

export default SearchGlass;
