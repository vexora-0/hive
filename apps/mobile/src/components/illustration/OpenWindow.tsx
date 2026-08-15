import React from 'react';
import { Circle, Line, Path, Rect } from 'react-native-svg';

import { IllustrationCanvas } from './IllustrationCanvas';
import type { IllustrationProps } from './types';

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/** The opening. Everything else is measured off it. */
const OPENING = { x: 18, y: 14, width: 64, height: 78 } as const;

/**
 * The casement, hinged on the opening's right stile and swung towards the
 * viewer. Its outer edge is drawn taller than its hinged edge — a leaf turning
 * out of the wall grows as it comes nearer — and that difference is the only
 * thing telling the eye the window is open rather than merely present. The
 * hinged edge itself is never drawn: the frame is already there, and a second
 * stroke along it would read as a doubled line.
 */
const CASEMENT = 'M82 14 L104 8 L104 98 L82 92';

/**
 * Distant hills, well clear of the sun.
 *
 * One unbroken curve with two peaks and a valley that never drops back to the
 * baseline. Both readings this has to avoid are close by: a single rise and
 * fall reads as water, and two separate arcs drawn over each other cross in a
 * visible X that reads as a bird. Two bumps on one line reads as land.
 *
 * The ends run down almost to the opening's lower corners, so the frame's own
 * bottom edge does the work of the ground. Held higher — a horizon with clear
 * space beneath it — the hills hover in the middle of the pane instead of
 * standing on anything. No detail beyond the two curves: the moment this
 * becomes a landscape it competes with the window, and the window is the
 * subject.
 */
const HILLS = 'M18 88 C26 72, 40 68, 52 84 C58 74, 70 70, 82 86';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<OpenWindow>` — a window standing open on a sun and far hills.
 *
 * For offline and full-screen error states. Those screens are usually drawn as
 * something severed: a broken link, a cloud with a slash, a plug pulled out.
 * All of them tell a parent the app is damaged. An open window says the
 * opposite and is just as true — the view is still there, we simply cannot
 * reach it this second — which is the right thing to say beside a Try again
 * button.
 *
 * ```tsx
 * <OpenWindow wash />
 * ```
 */
export function OpenWindow(props: IllustrationProps) {
  return (
    <IllustrationCanvas {...props} washShape={<Rect {...OPENING} />}>
      <Rect {...OPENING} />
      <Circle cx={42} cy={40} r={12} />
      <Path d={HILLS} />
      <Path d={CASEMENT} />
      <Line x1={10} y1={98} x2={108} y2={98} />
    </IllustrationCanvas>
  );
}

export default OpenWindow;
