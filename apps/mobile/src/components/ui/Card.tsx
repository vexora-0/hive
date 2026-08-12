import React, { useCallback } from 'react';
import {
  Pressable,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import {
  colors,
  layout,
  shadows,
  platformShadow,
  spring,
  pressScale,
} from '@/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** How far the surface sits off the page. */
export type CardElevation = 'flat' | 'low' | 'raised' | 'floating';

/** What the surface is made of. */
export type CardTone = 'paper' | 'sunk' | 'ink' | 'outline';

export interface CardProps {
  children: React.ReactNode;
  /** Inner padding — defaults to `layout.cardPadding` (16). */
  padding?: number;
  /** If provided the card becomes pressable with a spring-scale response. */
  onPress?: () => void;
  /** Fires on long press. */
  onLongPress?: () => void;
  /** Override border radius. */
  borderRadius?: number;
  /** How far off the page the card sits. Defaults to `'low'`. */
  elevation?: CardElevation;
  /** Surface material. Defaults to `'paper'`. */
  tone?: CardTone;
  /** Accessibility label when the card is pressable. */
  accessibilityLabel?: string;
  /** Override container style. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

const TONE_STYLES: Record<CardTone, ViewStyle> = {
  paper: {
    backgroundColor: colors.background.surface,
  },
  sunk: {
    backgroundColor: colors.background.surfaceSecondary,
  },
  ink: {
    backgroundColor: colors.ink[900],
  },
  outline: {
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
};

const ELEVATION_SHADOWS = {
  flat: shadows.none,
  low: shadows.small,
  raised: shadows.medium,
  floating: shadows.large,
} as const;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<Card>` — a surface resting on the page.
 *
 * The shadow is warm and wide rather than tight and grey, so a card reads as
 * paper on paper. Pressable cards move less than buttons do: a card is a
 * region you are entering, not a key you are striking.
 *
 * ```tsx
 * <Card elevation="raised" onPress={open}>
 *   <Text variant="h3">Sports day</Text>
 * </Card>
 * ```
 */
export function Card({
  children,
  padding = layout.cardPadding,
  onPress,
  onLongPress,
  borderRadius = layout.cardRadius,
  elevation = 'low',
  tone = 'paper',
  accessibilityLabel,
  style,
}: CardProps) {
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(pressScale.card, spring.press);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, spring.press);
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const surfaceStyle: ViewStyle = {
    padding,
    borderRadius,
    ...TONE_STYLES[tone],
    // An ink card gets an ink-coloured shadow; an umber one disappears on it.
    ...platformShadow(
      tone === 'ink' && elevation !== 'flat'
        ? shadows.onInk
        : ELEVATION_SHADOWS[elevation],
    ),
  };

  if (onPress || onLongPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onLongPress={onLongPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        style={[surfaceStyle, animatedStyle, style]}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return <View style={[surfaceStyle, style]}>{children}</View>;
}

/**
 * `<Divider>` — a hairline rule. Used to separate rows inside one card, never
 * to fence off regions that spacing has already separated.
 */
export function Divider({
  inset = 0,
  onInk = false,
  style,
}: {
  inset?: number;
  onInk?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        {
          height: 1,
          marginLeft: inset,
          backgroundColor: onInk ? colors.border.onInk : colors.border.light,
        },
        style,
      ]}
    />
  );
}

export default Card;
