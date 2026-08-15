import React from 'react';
import { Path, Polygon } from 'react-native-svg';

import { rotate, rotatedRect, toPath, toPoints, type Point } from './geometry';
import { IllustrationCanvas } from './IllustrationCanvas';
import type { IllustrationProps } from './types';

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

const X = 34;
const Y = 30;
const WIDTH = 52;
const HEIGHT = 62;

/**
 * The pivot sits well below the prints, so turning a card mostly slides it
 * sideways and only slightly tilts it — a hand fanning a stack. Rotating each
 * card about its own centre instead produces a pinwheel: three cards sharing
 * one middle, which reads as a shutter or a star and never as paper.
 */
const PIVOT_X = 60;
const PIVOT_Y = 128;

/** How much of a buried card shows before the card in front of it takes over. */
const REVEAL = 0.62;

/**
 * The cards behind are drawn as open paths — top-left corner, left edge,
 * bottom-left corner — and simply stop under the card in front. With no fills
 * anywhere in this language there is nothing to hide a line behind, so the
 * lines that would be hidden are never drawn. Ending them past the front
 * card's edge is what makes the stack read as depth rather than as three
 * outlines lying on top of each other.
 */
function buriedCard(angle: number): string {
  const cut = X + WIDTH * REVEAL;
  const corners: Point[] = [
    [cut, Y],
    [X, Y],
    [X, Y + HEIGHT],
    [cut, Y + HEIGHT],
  ];
  return toPath(corners.map(([x, y]) => rotate(x, y, angle, PIVOT_X, PIVOT_Y)));
}

const BACK = buriedCard(-13);
const MIDDLE = buriedCard(-5);

const FRONT_ANGLE = 7;
const FRONT = toPoints(
  rotatedRect(X, Y, WIDTH, HEIGHT, FRONT_ANGLE, PIVOT_X, PIVOT_Y),
);
/** Even border, deeper foot — the same mount proportion as `EmptyAlbum`. */
const FRONT_APERTURE = toPoints(
  rotatedRect(42, 38, 36, 38, FRONT_ANGLE, PIVOT_X, PIVOT_Y),
);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<StackOfPrints>` — three prints fanned, the top one showing its border.
 *
 * For the orders empty state. Only the front card gets an aperture: the border
 * is what makes a rectangle read as a *print* rather than as a card, and
 * repeating it three times turns the stack into a pattern. One is a
 * declaration, three is wallpaper.
 *
 * ```tsx
 * <StackOfPrints />
 * ```
 */
export function StackOfPrints(props: IllustrationProps) {
  return (
    <IllustrationCanvas
      {...props}
      washShape={<Polygon points={FRONT_APERTURE} />}
    >
      <Path d={BACK} />
      <Path d={MIDDLE} />
      <Polygon points={FRONT} />
      <Polygon points={FRONT_APERTURE} />
    </IllustrationCanvas>
  );
}

export default StackOfPrints;
