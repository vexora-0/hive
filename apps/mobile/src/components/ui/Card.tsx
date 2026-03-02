import React, { useCallback } from 'react';
import {
  Pressable,
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

import { colors, spacing, layout } from '@/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CardProps {
  children: React.ReactNode;
  /** Inner padding — defaults to `layout.cardPadding` (16). */
  padding?: number;
  /** If provided the card becomes pressable with a scale animation. */
  onPress?: () => void;
  /** Override border radius. */
  borderRadius?: number;
  /** Override container style. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Animation
// ---------------------------------------------------------------------------

const SPRING_CONFIG = { damping: 15, stiffness: 300 };
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<Card>` — rounded surface container with shadow.
 *
 * When `onPress` is provided the card is pressable and responds with a subtle
 * spring-scale animation.
 *
 * ```tsx
 * <Card onPress={() => router.push('/photo/1')}>
 *   <Text variant="h3">My Album</Text>
 * </Card>
 * ```
 */
export function Card({
  children,
  padding = layout.cardPadding,
  onPress,
  borderRadius = layout.cardRadius,
  style,
}: CardProps) {
  const scale = useSharedValue(1);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.97, SPRING_CONFIG);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG);
  }, [scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const cardStyle: ViewStyle = {
    padding,
    borderRadius,
  };

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        style={[styles.card, cardStyle, animatedStyle, style]}
      >
        {children}
      </AnimatedPressable>
    );
  }

  return <View style={[styles.card, cardStyle, style]}>{children}</View>;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.background.surface,
    // iOS shadow
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    // Android shadow
    elevation: 3,
    // overflow visible so shadow is not clipped
    overflow: 'visible',
  },
});

export default Card;
