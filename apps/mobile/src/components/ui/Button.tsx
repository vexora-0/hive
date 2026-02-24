import React, { useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { colors, spacing, layout, fontFamily, fontSize, lineHeight, MIN_TAP_SIZE } from '@/theme';
import { Text } from './Text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  /** Visual style variant. */
  variant?: ButtonVariant;
  /** Size preset. */
  size?: ButtonSize;
  /** Button label text. */
  children: string;
  /** Called on press — skipped while loading or disabled. */
  onPress?: () => void;
  /** Shows a spinner and disables interaction. */
  loading?: boolean;
  /** Disables interaction without showing a spinner. */
  disabled?: boolean;
  /** Optional icon rendered before the label. */
  leftIcon?: React.ReactNode;
  /** Optional icon rendered after the label. */
  rightIcon?: React.ReactNode;
  /** Override container style. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Style maps
// ---------------------------------------------------------------------------

const VARIANT_STYLES: Record<
  ButtonVariant,
  { bg: string; border: string; text: string; bgPressed: string }
> = {
  primary: {
    bg: colors.primary.amber,
    border: colors.primary.amber,
    text: colors.white,
    bgPressed: colors.primary.amberDark,
  },
  secondary: {
    bg: colors.primary.blue,
    border: colors.primary.blue,
    text: colors.white,
    bgPressed: colors.primary.blueDark,
  },
  outline: {
    bg: colors.transparent,
    border: colors.primary.amber,
    text: colors.primary.amber,
    bgPressed: colors.primary.amber + '14', // 8 % opacity
  },
  ghost: {
    bg: colors.transparent,
    border: colors.transparent,
    text: colors.primary.amber,
    bgPressed: colors.primary.amber + '14',
  },
};

const SIZE_STYLES: Record<
  ButtonSize,
  { height: number; paddingHorizontal: number; fontSize: number; lineHeight: number }
> = {
  sm: {
    height: MIN_TAP_SIZE,
    paddingHorizontal: spacing.md,
    fontSize: fontSize.bodySmall,
    lineHeight: lineHeight.bodySmall,
  },
  md: {
    height: 52,
    paddingHorizontal: spacing.lg,
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
  },
  lg: {
    height: 60,
    paddingHorizontal: spacing.xl,
    fontSize: fontSize.h4,
    lineHeight: lineHeight.h4,
  },
};

// ---------------------------------------------------------------------------
// Spring config
// ---------------------------------------------------------------------------

const SPRING_CONFIG = { damping: 15, stiffness: 300 };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * `<Button>` — primary call-to-action component.
 *
 * Features spring-scale press feedback, haptic response, a loading spinner
 * that doubles as a double-submit guard, and full accessibility.
 *
 * ```tsx
 * <Button variant="primary" size="md" onPress={save} loading={saving}>
 *   Save Photo
 * </Button>
 * ```
 */
export function Button({
  variant = 'primary',
  size = 'md',
  children,
  onPress,
  loading = false,
  disabled = false,
  leftIcon,
  rightIcon,
  style,
}: ButtonProps) {
  const scale = useSharedValue(1);
  const isInteractive = !disabled && !loading;
  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle = SIZE_STYLES[size];

  // Prevent rapid double-taps beyond the loading guard.
  const lastPressRef = useRef(0);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.96, SPRING_CONFIG);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG);
  }, [scale]);

  const handlePress = useCallback(() => {
    if (!isInteractive) return;
    const now = Date.now();
    if (now - lastPressRef.current < 400) return; // debounce
    lastPressRef.current = now;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }, [isInteractive, onPress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Math.max(sizeStyle.height, MIN_TAP_SIZE),
    paddingHorizontal: sizeStyle.paddingHorizontal,
    borderRadius: layout.buttonRadius,
    borderWidth: variant === 'outline' ? 2 : 0,
    borderColor: variantStyle.border,
    backgroundColor: variantStyle.bg,
    opacity: disabled ? 0.45 : 1,
    gap: spacing.sm,
  };

  const labelColor = loading
    ? colors.transparent // hide text behind spinner
    : variantStyle.text;

  return (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={!isInteractive}
      accessibilityRole="button"
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      style={[animatedStyle, containerStyle, style]}
    >
      {/* left icon */}
      {leftIcon && !loading && leftIcon}

      {/* label */}
      <Text
        variant="bodyBold"
        color={labelColor}
        style={{
          fontFamily: fontFamily.bodySemiBold,
          fontSize: sizeStyle.fontSize,
          lineHeight: sizeStyle.lineHeight,
        }}
      >
        {children}
      </Text>

      {/* spinner overlay */}
      {loading && (
        <ActivityIndicator
          color={variantStyle.text}
          size="small"
          style={StyleSheet.absoluteFill}
        />
      )}

      {/* right icon */}
      {rightIcon && !loading && rightIcon}
    </AnimatedPressable>
  );
}

export default Button;
