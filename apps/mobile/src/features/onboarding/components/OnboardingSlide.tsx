import React from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '@/theme';
import { Text } from '@/components/ui';
import type { OnboardingSlideData } from '@/features/onboarding/data/slides';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OnboardingSlideProps {
  /** Slide data (title, description, background colour). */
  slide: OnboardingSlideData;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const ANIMATION_SIZE = SCREEN_WIDTH * 0.65;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<OnboardingSlide>` renders a single slide inside the onboarding FlatList.
 *
 * Layout (top to bottom, centred):
 *   1. Lottie animation placeholder
 *   2. Title (h2)
 *   3. Description (body)
 */
export function OnboardingSlide({ slide }: OnboardingSlideProps) {
  return (
    <View
      style={[styles.container, { backgroundColor: slide.backgroundColor, width: SCREEN_WIDTH }]}
    >
      {/* Themed icon rather than emoji: emoji render differently on iOS and
          Android and cannot take a brand colour. See the note on
          `OnboardingSlideData.icon` for why this is not a Lottie. */}
      <View style={styles.animationContainer}>
        <View style={styles.animationPlaceholder}>
          <Ionicons
            name={slide.icon}
            size={ANIMATION_SIZE * 0.42}
            color={colors.primary.amber}
          />
        </View>
      </View>

      {/* Title */}
      <Text variant="h2" center style={styles.title}>
        {slide.title}
      </Text>

      {/* Description */}
      <Text
        variant="body"
        color={colors.text.secondary}
        center
        style={styles.description}
      >
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
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  animationContainer: {
    width: ANIMATION_SIZE,
    height: ANIMATION_SIZE,
    marginBottom: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  animationPlaceholder: {
    width: ANIMATION_SIZE,
    height: ANIMATION_SIZE,
    borderRadius: ANIMATION_SIZE / 2,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    // Subtle shadow
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  title: {
    marginBottom: spacing.md,
  },
  description: {
    maxWidth: 300,
  },
});

export default OnboardingSlide;
