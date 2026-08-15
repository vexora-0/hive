import React, { useCallback } from 'react';
import {
  Pressable,
  StyleSheet,
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
  /**
   * Lays the children out in a row, vertically centred — the shape almost every
   * list row wants: a face, a stack of words, a trailing mark.
   */
  row?: boolean;
  /** Space between children, in either direction. */
  gap?: number;
  /** Blocks the press and dims the card. Only meaningful when pressable. */
  disabled?: boolean;
  /** Accessibility label when the card is pressable. */
  accessibilityLabel?: string;
  /** Announced after the label — where the press leads, when it is not obvious. */
  accessibilityHint?: string;
  /** Test hook. */
  testID?: string;
  /** Override container style. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Surfaces
//
// `ink` is `ink[900]` — the same tone as the tab bar and the app's other dark
// panels, deliberately *not* the photo viewer's `#0B0B0C`. A card holds
// interface; the viewer holds a photograph, and a near-neutral ground is only
// worth having where a violet cast would shift the picture's white balance.
//
// Text on an ink card must come from the ink pair: `<Text onInk>` is 14.09:1
// and `<Text onInk muted>` is 7.63:1. Nothing else in the palette is legible
// there, and a card cannot colour its children for them.
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
 * paper on paper. Pressable cards move less than buttons do: a card is a region
 * you are entering, not a key you are striking.
 *
 * `row` and `gap` are here because the shape that kept getting hand-rolled was
 * always the same one — an avatar, a stack of words and a trailing mark, on a
 * white surface with a hairline shadow. Six files each re-declared it slightly
 * differently, which is how a design system quietly acquires four radii and
 * three shadows. Reach for this before writing another `backgroundColor:
 * colors.background.surface`.
 *
 * **Not for photographs.** A card is 22pt round; a photograph takes
 * `radius.print` (4) or `radius.mount` (6) and never more. Put the mount inside
 * the card, never the photograph in place of one.
 *
 * ```tsx
 * <Card row gap={spacing.ms} onPress={openChild} accessibilityLabel="Aarav S">
 *   <Avatar name="Aarav S" size="md" />
 *   <View style={{ flex: 1 }}>
 *     <Text variant="h4">Aarav S</Text>
 *     <Text variant="bodySmall" muted>Sunflower</Text>
 *   </View>
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
  row = false,
  gap,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  testID,
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
    ...(gap !== undefined ? { gap } : null),
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
        disabled={disabled}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint={accessibilityHint}
        accessibilityState={{ disabled }}
        style={[
          surfaceStyle,
          row && styles.row,
          disabled && styles.disabled,
          animatedStyle,
          style,
        ]}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return (
    <View style={[surfaceStyle, row && styles.row, style]} testID={testID}>
      {children}
    </View>
  );
}

/**
 * `<Divider>` — a hairline rule. Used to separate rows inside one card, never
 * to fence off regions that spacing has already separated.
 */
export function Divider({
  inset = 0,
  onInk = false,
  vertical = false,
  style,
}: {
  /** Indents the rule from its leading edge, so it starts under the text. */
  inset?: number;
  /** Draws the rule for a dark surface. */
  onInk?: boolean;
  /** Splits a row rather than a column — for two figures side by side. */
  vertical?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        vertical ? styles.dividerVertical : styles.dividerHorizontal,
        vertical ? { marginTop: inset } : { marginLeft: inset },
        {
          backgroundColor: onInk ? colors.border.onInk : colors.border.light,
        },
        style,
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  disabled: {
    opacity: 0.45,
  },
  dividerHorizontal: {
    height: layout.hairline,
  },
  dividerVertical: {
    width: layout.hairline,
    alignSelf: 'stretch',
  },
});

export default Card;
