import React, { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { MotiView } from 'moti';
import Svg, { Path } from 'react-native-svg';

import {
  colors,
  play,
  spacing,
  radius,
  spring,
  useReducedMotion,
} from '@/theme';
import { Text } from '@/components/ui/Text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Which edge the tail leaves from — i.e. where Bo is standing. */
export type TailSide = 'bottom' | 'top' | 'left' | 'right';

export interface SpeechBubbleProps {
  /** What Bo says. Short — this is a line of dialogue, not a paragraph. */
  children: string;
  /** Which edge the tail points from. @default 'bottom' */
  tail?: TailSide;
  /**
   * How far along that edge the tail sits, 0–1. Point it at the character:
   * a tail leaving the centre of a bubble that sits above a Bo standing on the
   * left is the detail that makes a speech bubble look like a tooltip.
   * @default 0.5
   */
  tailAt?: number;
  /** Delay before the bubble pops in, in ms. For staggering with the mascot. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

const TAIL_W = 20;
const TAIL_H = 13;
/** The border weight, shared by the bubble and the tail so the joint is invisible. */
const LINE = 2.5;
/**
 * How far the tail is pulled back into the bubble.
 *
 * It has to be more than the border weight, or a hairline of the bubble's own
 * outline shows across the mouth of the tail — the one flaw that makes a
 * hand-drawn bubble look assembled from two rectangles.
 */
const OVERLAP = LINE + 1;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<SpeechBubble>` — Bo talking.
 *
 * The only place in the app that sets the play voice below 25pt, which is a
 * licence this component earns by being unmistakably attributed: a rounded face
 * inside an outlined bubble with a tail is dialogue, and dialogue is allowed to
 * sound like a person. The same words in the same font without the bubble would
 * just be the app being twee at you.
 *
 * It pops rather than fades. `spring.alive` is the mascot's spring — ζ 0.42,
 * with a visible overshoot — and a bubble that arrives by overshooting and
 * settling reads as somebody starting to speak. A 200ms crossfade reads as a
 * tooltip.
 *
 * ```tsx
 * <SpeechBubble tail="bottom" tailAt={0.25}>Hi! I&apos;m Bo.</SpeechBubble>
 * ```
 */
export function SpeechBubble({
  children,
  tail = 'bottom',
  tailAt = 0.5,
  delay = 0,
  style,
}: SpeechBubbleProps) {
  const reduced = useReducedMotion();

  /**
   * Whether the bubble has arrived. **It is not rendered at all until it has.**
   *
   * This is a mount gate rather than an opacity animation, and the distinction
   * is the whole reliability story of this component.
   *
   * The obvious build — `from={{opacity: 0}}` with Moti's own `delay` — leaves
   * the bubble at `opacity: 0` if the animation never runs, and an animation
   * that never runs is exactly the failure mode this project already has a
   * documented history of: under its Reanimated 4 setup, which still registers
   * the deprecated `react-native-reanimated/plugin`, animation values written
   * from JavaScript have more than once silently failed to reach the view.
   * Nothing errors. The bubble is just not there, and a screenshot is the only
   * way to find out.
   *
   * So **nothing here depends on an animation to become visible.** The timer
   * decides whether the bubble exists; once it does, it is opaque. The spring
   * animates scale and offset only — polish on top of something already legible
   * — which means the worst case is a bubble that appears without a pop, not a
   * bubble that never appears. It is the same principle Reduce Motion enforces
   * everywhere else in this app: an animation may add delight and must never
   * carry content.
   */
  const [shown, setShown] = useState(delay === 0);

  useEffect(() => {
    if (delay === 0) return;
    const timer = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!shown) return null;

  const horizontal = tail === 'top' || tail === 'bottom';
  // Typed as a percentage template literal rather than `string`: RN's
  // `DimensionValue` only accepts `${number}%`, and a plain string here is the
  // one thing that makes this whole style object fail to typecheck.
  const along: `${number}%` = `${Math.round(
    Math.min(Math.max(tailAt, 0.08), 0.92) * 100,
  )}%`;

  // The tail is one triangle rotated to whichever edge it leaves from, and
  // nudged back under the border by OVERLAP. Written as a lookup rather than
  // four branches so the four cases cannot drift apart.
  const tailStyle: ViewStyle = {
    position: 'absolute',
    width: horizontal ? TAIL_W : TAIL_H,
    height: horizontal ? TAIL_H : TAIL_W,
    ...(tail === 'bottom' && { bottom: -TAIL_H + OVERLAP, left: along }),
    ...(tail === 'top' && { top: -TAIL_H + OVERLAP, left: along }),
    ...(tail === 'left' && { left: -TAIL_H + OVERLAP, top: along }),
    ...(tail === 'right' && { right: -TAIL_H + OVERLAP, top: along }),
    transform: [
      { translateX: horizontal ? -TAIL_W / 2 : 0 },
      { translateY: horizontal ? 0 : -TAIL_W / 2 },
    ],
  };

  const rotate =
    tail === 'bottom' ? 0 : tail === 'top' ? 180 : tail === 'left' ? 90 : 270;

  return (
    <MotiView
      style={[styles.host, style]}
      // Transforms only, and no opacity anywhere in this animation — see the
      // note on `shown`. `from` is safe here precisely because a bubble stuck
      // at its start value is still a fully readable bubble, 12% small.
      from={{ scale: reduced ? 1 : 0.88, translateY: reduced ? 0 : 6 }}
      animate={{ scale: 1, translateY: 0 }}
      transition={
        reduced
          ? { type: 'timing', duration: 0 }
          : { ...spring.alive, type: 'spring' }
      }
    >
      <View style={styles.bubble}>
        <Text variant="playSpeech" color={colors.text.primary}>
          {children}
        </Text>
      </View>

      <View style={tailStyle} pointerEvents="none">
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${TAIL_W} ${TAIL_H}`}
          style={{ transform: [{ rotate: `${rotate}deg` }] }}
        >
          {/* Open path, not closed. The two slanted edges are stroked and the
              mouth is left bare, so the tail's fill runs straight into the
              bubble's without a line across it. */}
          <Path
            d={`M0 0 L${TAIL_W / 2} ${TAIL_H} L${TAIL_W} 0`}
            fill={play.paper}
            stroke={colors.ink[900]}
            strokeWidth={LINE}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
    </MotiView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  host: {
    alignSelf: 'flex-start',
    maxWidth: 300,
  },
  bubble: {
    backgroundColor: play.paper,
    borderWidth: LINE,
    borderColor: colors.ink[900],
    // Not the card radius. A bubble is rounder than anything else in the app
    // on purpose — it is the one shape that has to read as *drawn* rather than
    // as a container, and 28 against the card's 22 is enough to tell them apart
    // without inventing a sixth radius.
    borderRadius: radius.xl,
    paddingVertical: spacing.ms,
    paddingHorizontal: spacing.md,
  },
});

export default SpeechBubble;
