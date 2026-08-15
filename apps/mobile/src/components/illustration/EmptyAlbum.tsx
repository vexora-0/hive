import React from 'react';
import { Polygon } from 'react-native-svg';

import { rotatedRect, toPoints } from './geometry';
import { IllustrationCanvas } from './IllustrationCanvas';
import type { IllustrationProps } from './types';

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/**
 * A mount, not a frame: the margins are a real mount's — even at the sides and
 * top, deeper at the foot. That single asymmetry is what separates a
 * photographic mount from a rectangle inside a rectangle, and it is the same
 * proportion `PhotoMount` gives a photograph on the feed. The drawing is the
 * app's own mechanism with the picture missing, which is exactly what the
 * screen is saying.
 */
const TILT = -5;

const MOUNT = toPoints(rotatedRect(22, 14, 76, 92, TILT, 60, 60));
const APERTURE = toPoints(rotatedRect(36, 28, 48, 56, TILT, 60, 60));

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<EmptyAlbum>` — an empty paper mount, lying slightly askew.
 *
 * For "no photos yet". The tilt is doing work: square to the screen this reads
 * as a UI placeholder, five degrees off it reads as a thing on a table waiting
 * for something to be put in it. Hopeful rather than broken, which is the
 * register a parent opening Hive on a quiet week deserves.
 *
 * ```tsx
 * <EmptyAlbum />
 * ```
 */
export function EmptyAlbum(props: IllustrationProps) {
  return (
    <IllustrationCanvas {...props} washShape={<Polygon points={APERTURE} />}>
      <Polygon points={MOUNT} />
      <Polygon points={APERTURE} />
    </IllustrationCanvas>
  );
}

export default EmptyAlbum;
