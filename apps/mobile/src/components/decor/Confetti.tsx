import React, { useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import Svg, { Path, Polygon } from 'react-native-svg';

import {
  play,
  PLAY_HUES,
  hexPoints,
  easing,
  useReducedMotion,
} from '@/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConfettiProps {
  /**
   * Flip to `true` at the moment worth celebrating. Flipping back and forward
   * again replays it; leaving it true does **not** loop.
   */
  active: boolean;
  /** How many pieces. @default 22 */
  count?: number;
  /** Where the burst comes from, as a fraction of the host. @default {x: 0.5, y: 0.4} */
  origin?: { x: number; y: number };
  /** Called once the last piece has landed, so a parent can unmount the layer. */
  onDone?: () => void;
  style?: StyleProp<ViewStyle>;
}

/** Total flight time. Inside the 400ms budget only because nobody waits on it. */
const RISE_MS = 520;
const FALL_MS = 900;
const TOTAL_MS = RISE_MS + FALL_MS;

type PieceShape = 'cell' | 'heart' | 'sparkle' | 'chip';
const SHAPES: readonly PieceShape[] = ['cell', 'heart', 'sparkle', 'chip'];

/** Deterministic scatter — see the same function in `PollenDrift`. */
function scatter(n: number): number {
  const x = Math.sin(n * 78.233 + 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<Confetti>` — the celebration.
 *
 * **One call site: the order-placed panel. Keep it that way.**
 *
 * There was confetti in this app before and it was removed, correctly, for
 * firing on a panel somebody could meet every working day. The test it failed
 * is the test to apply to any new call site: *how often does one person see
 * this?* A parent paying to have a photograph of their child printed and posted
 * reaches the order panel perhaps once a term, which is rare enough for a
 * celebration to still feel like one. A teacher finishing an upload reaches
 * that screen every afternoon, so it gets a cheering Bo and no confetti —
 * warmth without a party. Confetti at every success is a party nobody can hear,
 * and the first time it appears somewhere ordinary it stops meaning anything
 * anywhere.
 *
 * The pieces are the app's own vocabulary rather than generic rectangles: comb
 * cells, hearts, sparkles and chips, in the five play hues. That is what makes
 * a burst read as *this* app being pleased rather than as a stock effect
 * dropped in.
 *
 * **Each piece flies in two phases** — up fast on a decelerating curve, then
 * down slower on an accelerating one. A single tween to a final position is the
 * usual shortcut and it is why most confetti looks like it is being sucked
 * downward: real confetti has an apex.
 *
 * **Skipped entirely under Reduce Motion**, where the parent screen's own
 * heading is what says it worked.
 */
export function Confetti({
  active,
  count = 22,
  origin = { x: 0.5, y: 0.4 },
  onDone,
  style,
}: ConfettiProps) {
  const reduced = useReducedMotion();
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  /**
   * Whether the pieces have been thrown.
   *
   * Every piece is `animate`-only and flips on one frame after mount, for the
   * reason spelled out in `SpeechBubble`: a Moti `from` never leaves its
   * initial value under this project's Reanimated setup, so confetti written
   * the obvious way would sit in a pile at the origin at scale 0.2 and never
   * move — invisible, and silent about it.
   */
  const [launched, setLaunched] = useState(false);

  useEffect(() => {
    if (!active) {
      setLaunched(false);
      return;
    }
    if (reduced) {
      doneRef.current?.();
      return;
    }
    // One tick, so the pieces mount at rest and then travel. Throwing them in
    // the same frame they appear gives the animation nothing to interpolate
    // from and they simply teleport.
    const start = setTimeout(() => setLaunched(true), 16);
    const finish = setTimeout(() => doneRef.current?.(), TOTAL_MS + 200);
    return () => {
      clearTimeout(start);
      clearTimeout(finish);
    };
  }, [active, reduced]);

  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const a = scatter(i);
        const b = scatter(i + 50);
        const c = scatter(i + 150);
        // Spread across a 180° fan rather than a full circle: everything is
        // thrown upward and outward, which is what a burst does, and half the
        // pieces launching straight down looks like a leak.
        const angle = Math.PI * (0.08 + a * 0.84);
        const power = 90 + b * 130;
        return {
          key: i,
          shape: SHAPES[i % SHAPES.length],
          hue: play[PLAY_HUES[i % PLAY_HUES.length]],
          size: 12 + c * 12,
          dx: Math.cos(angle) * power * (a > 0.5 ? 1 : -1),
          rise: -Math.sin(angle) * power - 40,
          fall: 220 + c * 190,
          spin: Math.round((a - 0.5) * 720),
          delay: Math.round(b * 140),
        };
      }),
    [count],
  );

  if (!active || reduced) return null;

  return (
    <View
      style={[styles.host, style]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {pieces.map((p) => (
        <MotiView
          key={p.key}
          style={{
            position: 'absolute',
            left: `${origin.x * 100}%`,
            top: `${origin.y * 100}%`,
          }}
          animate={{
            translateX: launched ? p.dx : 0,
            // Two phases, expressed as a Moti sequence: up on a decelerating
            // curve, then down on an accelerating one. This is the apex.
            translateY: launched
              ? [
                  {
                    value: p.rise,
                    type: 'timing',
                    duration: RISE_MS,
                    easing: easing.decelerate,
                  },
                  {
                    value: p.fall,
                    type: 'timing',
                    duration: FALL_MS,
                    easing: easing.accelerate,
                  },
                ]
              : 0,
            scale: launched ? 1 : 0.2,
            rotate: launched ? `${p.spin}deg` : '0deg',
            // Held at full through the rise, gone by the time it would leave
            // the screen — a piece that fades on the way up looks like it
            // failed rather than flew.
            opacity: launched
              ? [
                  { value: 1, type: 'timing', duration: RISE_MS },
                  { value: 0, type: 'timing', duration: FALL_MS },
                ]
              : 1,
          }}
          transition={{
            type: 'timing',
            duration: TOTAL_MS,
            delay: p.delay,
            easing: easing.standard,
          }}
        >
          <Piece shape={p.shape} size={p.size} hue={p.hue} />
        </MotiView>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// One piece
// ---------------------------------------------------------------------------

function Piece({
  shape,
  size,
  hue,
}: {
  shape: PieceShape;
  size: number;
  hue: { soft: string; base: string; deep: string };
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40">
      {shape === 'cell' && (
        <Polygon
          points={hexPoints(20, 20, 17)}
          fill={hue.base}
          stroke={hue.deep}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      )}
      {shape === 'heart' && (
        <Path
          d="M20 35 Q3 22 3 13 Q3 4 11 4 Q18 4 20 11 Q22 4 29 4 Q37 4 37 13 Q37 22 20 35 Z"
          fill={hue.base}
          stroke={hue.deep}
          strokeWidth={2.2}
          strokeLinejoin="round"
        />
      )}
      {shape === 'sparkle' && (
        <Path
          d="M20 3 Q23 17 37 20 Q23 23 20 37 Q17 23 3 20 Q17 17 20 3 Z"
          fill={hue.base}
          stroke={hue.deep}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      )}
      {shape === 'chip' && (
        <Path
          d="M20 5 Q31 5 31 20 Q31 35 20 35 Q9 35 9 20 Q9 5 20 5 Z"
          fill={hue.base}
          stroke={hue.deep}
          strokeWidth={2}
        />
      )}
    </Svg>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'visible',
  },
});

export default Confetti;
