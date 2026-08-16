import React from 'react';
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, play } from '@/theme';
import { CombField } from './CombField';
import { PollenDrift } from './PollenDrift';
import { SunGlow } from './SunGlow';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * How much weather a screen gets.
 *
 * The scale is not decorative preference — it tracks how much a screen has to
 * carry on its own.
 *
 *  - `hero` — the screen *is* the atmosphere. Onboarding, login, an empty
 *    feed. Full light, a visible comb, pollen.
 *  - `page` — a screen with real content on it. Light and a whisper of comb;
 *    no pollen, because content that scrolls past drifting motes reads as a
 *    rendering fault.
 *  - `quiet` — light only. For screens holding photographs, where anything
 *    behind the picture is competing with it.
 */
export type BackdropLevel = 'hero' | 'page' | 'quiet';

export interface PlayfulBackdropProps {
  /** @default 'page' */
  level?: BackdropLevel;
  /**
   * The hue of the light. Defaults to marigold; pass a role's play colour to
   * tint a whole area — the teacher's screens in sky, the admin's in grape.
   */
  tint?: string;
  /**
   * How far down the screen the weather reaches, in px. Defaults to 44% of the
   * viewport height, which puts the falloff behind the header and above the
   * first row of content on every phone size this app targets.
   */
  depth?: number;
  /** Paints the page colour underneath. Turn off over an existing surface. @default true */
  ground?: boolean;
  style?: StyleProp<ViewStyle>;
}

const LEVELS: Record<
  BackdropLevel,
  { glow: number; comb: number | null; combCell: number; pollen: number }
> = {
  hero: { glow: 0.2, comb: 0.07, combCell: 38, pollen: 10 },
  page: { glow: 0.15, comb: 0.045, combCell: 30, pollen: 0 },
  quiet: { glow: 0.1, comb: null, combCell: 0, pollen: 0 },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<PlayfulBackdrop>` — the three atmosphere layers, composed.
 *
 * Light, then comb, then pollen, in that order and never any other: the light
 * has to be underneath or it washes the comb out, and the pollen has to be on
 * top or it is behind the texture it is supposed to be floating in front of.
 * Composing them by hand at each call site is how that order gets broken, so it
 * is not offered.
 *
 * Drop it as the first child of a screen and let everything else paint over:
 *
 * ```tsx
 * <View style={{ flex: 1 }}>
 *   <PlayfulBackdrop level="hero" />
 *   <ScrollView>…</ScrollView>
 * </View>
 * ```
 *
 * It is `position: absolute` and `pointerEvents: none`, so it never takes a
 * touch and never affects layout.
 */
export function PlayfulBackdrop({
  level = 'page',
  tint = play.honey.base,
  depth,
  ground = true,
  style,
}: PlayfulBackdropProps) {
  const { width, height } = useWindowDimensions();
  const spec = LEVELS[level];
  const reach = depth ?? Math.round(height * 0.44);

  return (
    <View
      style={[
        styles.host,
        ground && { backgroundColor: colors.background.cream },
        style,
      ]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <SunGlow
        width={width}
        height={reach}
        tint={tint}
        intensity={spec.glow}
        style={styles.layer}
      />

      {spec.comb !== null && (
        <CombField
          width={width}
          height={reach}
          cell={spec.combCell}
          opacity={spec.comb}
          color={tint}
          dense={level === 'hero'}
          style={styles.layer}
        />
      )}

      {spec.pollen > 0 && (
        <PollenDrift
          width={width}
          height={reach}
          count={spec.pollen}
          color={tint}
          style={styles.layer}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
});

export default PlayfulBackdrop;
