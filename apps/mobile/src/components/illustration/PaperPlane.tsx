import React from 'react';
import { Path, Polygon } from 'react-native-svg';

import { toPath, toPoints, type Point } from './geometry';
import { IllustrationCanvas } from './IllustrationCanvas';
import type { IllustrationProps } from './types';

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/**
 * Four points and one crease.
 *
 * The dart is drawn as a silhouette with a concave notch, plus the keel fold
 * running from the nose back to that notch. The fold is the whole illustration:
 * without it the shape is a send arrow, with it the shape is folded paper. It
 * costs one line.
 *
 * No speed trail. The other six drawings hold still, and a motion mark on one
 * of them would break the set apart faster than any difference of weight.
 */
const NOSE: Point = [104, 14];
const WING_TIP: Point = [14, 48];
const NOTCH: Point = [56, 66];
const TAIL: Point = [76, 104];

const BODY = toPoints([NOSE, WING_TIP, NOTCH, TAIL]);
const KEEL = toPath([NOSE, NOTCH]);

/** The near wing — the one facet a viewer reads as the top surface. */
const NEAR_WING = toPoints([NOSE, WING_TIP, NOTCH]);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<PaperPlane>` — a folded paper dart, climbing.
 *
 * For "nothing shared yet" and for sent states. A preschool's photographs are
 * something a teacher hands to a family, so the object for sending is the one
 * a child would actually fold, not an envelope and certainly not a cloud with
 * an arrow in it.
 *
 * ```tsx
 * <PaperPlane wash />
 * ```
 */
export function PaperPlane(props: IllustrationProps) {
  return (
    <IllustrationCanvas {...props} washShape={<Polygon points={NEAR_WING} />}>
      <Polygon points={BODY} />
      <Path d={KEEL} />
    </IllustrationCanvas>
  );
}

export default PaperPlane;
