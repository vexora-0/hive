import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius, layout, shadows, platformShadow } from '@/theme';
import { Text } from '@/components/ui';
import { HoneycombPattern } from '@/components/animation';
import type { OnboardingSlideData } from '@/features/onboarding/data/slides';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OnboardingSlideProps {
  /** Slide data (title, description, tint). */
  slide: OnboardingSlideData;
  /**
   * Height of the pager, measured by the parent.
   *
   * A horizontal list gives its items no height to fill — the row is only as
   * tall as its tallest child — so `flex: 1` on the slide centres nothing and
   * the copy sits jammed under the status bar. The parent measures once and
   * passes the number down.
   */
  height: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const TILE = 108;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<OnboardingSlide>` — one page of the intro carousel.
 *
 * The illustration is a paper tile carrying a tinted icon, sitting on a faint
 * comb. Slides are left-aligned rather than centred, so the three headlines
 * share a margin as you swipe and the text does not jump horizontally between
 * pages.
 */
export function OnboardingSlide({ slide, height }: OnboardingSlideProps) {
  return (
    <View style={[styles.container, { width: SCREEN_WIDTH, height }]}>
      <View pointerEvents="none" style={styles.combLayer}>
        <View style={styles.combInner}>
          <HoneycombPattern rows={4} cols={5} size={30} color={`${slide.tint}12`} />
        </View>
      </View>

      <View style={[styles.tile, { backgroundColor: slide.wash }]}>
        <Ionicons name={slide.icon} size={TILE * 0.42} color={slide.tint} />
      </View>

      <Text variant="h1" style={styles.title}>
        {slide.title}
      </Text>

      <Text variant="body" muted style={styles.description}>
        {slide.description}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    paddingHorizontal: layout.screenPaddingHorizontal,
    backgroundColor: colors.background.cream,
  },
  /** Clips the comb so its negative offset cannot widen the pager. */
  combLayer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  combInner: {
    position: 'absolute',
    top: '12%',
    right: -50,
  },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
    ...platformShadow(shadows.small),
  },
  title: {
    marginBottom: spacing.ms,
    maxWidth: 330,
  },
  description: {
    maxWidth: 330,
  },
});

export default OnboardingSlide;
