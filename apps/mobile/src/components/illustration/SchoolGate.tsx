import React from 'react';
import { Line, Path, Rect } from 'react-native-svg';

import { IllustrationCanvas } from './IllustrationCanvas';
import type { IllustrationProps } from './types';

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/**
 * A schoolhouse assembled from the smallest number of marks that still say
 * "school": a pitched roof with an overhanging eave, a door tall enough to
 * walk through, two windows, a flag.
 *
 * Every shape that meets the ground is drawn open at the foot so the ground
 * line is the only base. Two coincident strokes at the same coordinates render
 * heavier than one, and the eye reads that as a mistake even when it cannot
 * say why.
 */
const GROUND = 'M12 104 L108 104';
const WALLS = 'M28 104 L28 54 L92 54 L92 104';
const ROOF = 'M20 54 L60 28 L100 54';
const DOOR = 'M52 104 L52 78 L68 78 L68 104';
const FLAG = 'M60 11 L78 16 L60 21';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<SchoolGate>` — a small schoolhouse under its flag.
 *
 * For "no school assigned", where the account exists but has nowhere to point.
 * The building is drawn whole and standing, because the problem is a missing
 * link and not a broken school; a ruin or a padlock would tell the parent
 * something untrue about their child's nursery.
 *
 * ```tsx
 * <SchoolGate />
 * ```
 */
export function SchoolGate(props: IllustrationProps) {
  return (
    <IllustrationCanvas
      {...props}
      washShape={<Rect x={28} y={54} width={64} height={50} />}
    >
      <Line x1={60} y1={28} x2={60} y2={10} />
      <Path d={FLAG} />
      <Path d={ROOF} />
      <Path d={WALLS} />
      <Rect x={36} y={64} width={12} height={12} />
      <Rect x={72} y={64} width={12} height={12} />
      <Path d={DOOR} />
      <Path d={GROUND} />
    </IllustrationCanvas>
  );
}

export default SchoolGate;
