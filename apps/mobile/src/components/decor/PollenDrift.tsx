import React, { useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { MotiView } from 'moti';

import {
  play,
  radius,
  ambient,
  phase,
  easing,
  useReducedMotion,
} from '@/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PollenDriftProps {
  /** Area to cover, in px. */
  width: number;
  height: number;
  /** How many motes. @default 9 */
  count?: number;
  /** Mote colour. @default marigold */
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * A deterministic pseudo-random in [0, 1) from an integer.
 *
 * `Math.random()` would reposition every mote on every re-render, which on a
 * screen that re-renders while scrolling looks like the dust is being shaken.
 * A hash of the index gives the same scatter forever and costs nothing.
 */
function scatter(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<PollenDrift>` — motes of pollen rising slowly through a screen.
 *
 * The third and quietest layer of the backdrop, after the light and the comb.
 * It is the one that makes a screen feel *inhabited* rather than merely
 * decorated, and it works for the same reason dust in a sunbeam does: the eye
 * reads slow independent motion as air.
 *
 * **The word "independent" is doing the work.** Nine motes rising on the same
 * 4.2-second cycle is a progress bar. Each one here is offset by
 * `phase(index, period)`, which spreads them by the golden ratio so no two ever
 * beat together, and each gets its own duration from the same hash that places
 * it — so they also drift at different speeds.
 *
 * **Skipped entirely under Reduce Motion.** A permanently animating background
 * is the single most common accessibility failure in a design like this one,
 * and there is no reduced version of this effect worth showing: motionless
 * pollen is just specks.
 */
export function PollenDrift({
  width,
  height,
  count = 9,
  color = play.honey.base,
  style,
}: PollenDriftProps) {
  const reduced = useReducedMotion();

  const motes = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const a = scatter(i);
        const b = scatter(i + 100);
        const c = scatter(i + 200);
        return {
          key: i,
          left: a * width,
          top: b * height,
          size: 3 + c * 5,
          // ±35% around the base period, so the field never resolves into a
          // rhythm.
          duration: Math.round(ambient.drift * (0.65 + c * 0.7)),
          delay: phase(i, ambient.drift),
          rise: 18 + b * 26,
          sway: (a - 0.5) * 22,
          opacity: 0.25 + c * 0.35,
        };
      }),
    [count, width, height],
  );

  if (reduced) return null;

  return (
    <View
      style={[styles.host, { width, height }, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {motes.map((m) => (
        <MotiView
          key={m.key}
          // Position only. The mote's opacity lives in its style below, so a
          // mote whose animation never starts is a mote sitting still — which
          // is what a speck of dust does anyway — rather than an invisible one.
          from={{ translateY: 0, translateX: 0 }}
          animate={{
            translateY: -m.rise,
            translateX: m.sway,
          }}
          transition={{
            type: 'timing',
            duration: m.duration,
            delay: m.delay,
            easing: easing.standard,
            loop: true,
            repeatReverse: true,
          }}
          style={{
            position: 'absolute',
            left: m.left,
            top: m.top,
            width: m.size,
            height: m.size,
            borderRadius: radius.pill,
            backgroundColor: color,
            opacity: m.opacity,
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  host: { overflow: 'hidden' },
});

export default PollenDrift;
