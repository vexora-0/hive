import React, { useEffect, useState } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { MotiView } from 'moti';

import { spacing, spring, useReducedMotion } from '@/theme';
import { Bo, type BoPose } from './Bo';
import { SpeechBubble } from './SpeechBubble';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MascotGuideProps {
  /** What Bo is doing. */
  pose?: BoPose;
  /**
   * What she says. Omit it and you get a mascot with no bubble — which is the
   * right call whenever the screen already has a headline saying the same
   * thing, because Bo repeating the heading in a bubble is two of the same
   * sentence stacked.
   */
  say?: string;
  /** Bo's height in px. @default 132 */
  size?: number;
  /**
   * Which side Bo stands on. The bubble goes on the other, and the tail points
   * back at her. @default 'left'
   */
  side?: 'left' | 'right';
  /** Delay before the pair arrives, in ms. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<MascotGuide>` — Bo, and the thing she is saying.
 *
 * The composition is the point. Bo always faces *into* the bubble (which is why
 * `flip` is derived from `side` rather than passed), the tail always points
 * back at her head rather than at the middle of nowhere, and she arrives a beat
 * before the words so the sequence reads as somebody turning up and then
 * speaking — not as two panels fading in together.
 *
 * ```tsx
 * <MascotGuide pose="wave" say="Hi! I'm Bo. I'll show you around." />
 * <MascotGuide pose="hide" say="I'm not looking." side="right" />
 * ```
 */
export function MascotGuide({
  pose = 'idle',
  say,
  size = 132,
  side = 'left',
  delay = 0,
  style,
}: MascotGuideProps) {
  const reduced = useReducedMotion();
  const onLeft = side === 'left';

  // `animate`-only, flipped after mount. See the long note in `SpeechBubble`:
  // a Moti `from` never leaves its initial value under this project's
  // Reanimated setup, so an entrance written that way silently never plays.
  const [shown, setShown] = useState(delay === 0);

  useEffect(() => {
    if (delay === 0) return;
    const timer = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <View
      style={[styles.row, onLeft ? styles.rowLeft : styles.rowRight, style]}
    >
      {/* Transforms only. Bo's visibility is decided by whether she is
          rendered, never by an opacity an animation has to finish — the same
          rule, and the same reason, as the note on `shown` in
          `SpeechBubble`. */}
      <MotiView
        animate={{
          scale: shown || reduced ? 1 : 0.72,
          translateY: shown || reduced ? 0 : 14,
        }}
        transition={
          reduced
            ? { type: 'timing', duration: 0 }
            : { ...spring.alive, type: 'spring' }
        }
      >
        {/* Facing into the bubble. A mascot pointing off the edge of the screen
            is the most common way this composition goes wrong. */}
        <Bo pose={pose} size={size} flip={!onLeft} />
      </MotiView>

      {say && (
        <SpeechBubble
          // 220ms after Bo lands: long enough to read as a beat, short enough
          // that nobody notices they waited.
          delay={delay + 220}
          tail={onLeft ? 'left' : 'right'}
          tailAt={0.72}
          style={styles.bubble}
        >
          {say}
        </SpeechBubble>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    // Bottom rather than centre: Bo and her bubble should share a ground line
    // the way two people standing together do. Centred, a tall bubble floats
    // her.
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  rowLeft: { justifyContent: 'flex-start' },
  rowRight: { flexDirection: 'row-reverse', justifyContent: 'flex-start' },
  bubble: {
    flexShrink: 1,
    marginBottom: spacing.lg,
  },
});

export default MascotGuide;
