import React, { useCallback, useRef } from 'react';
import {
  ActivityIndicator,
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
import * as Haptics from 'expo-haptics';

import {
  colors,
  spacing,
  radius,
  fontFamily,
  fontSize,
  lineHeight,
  spring,
  pressScale,
  MIN_TAP_SIZE,
} from '@/theme';
import { Text } from './Text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger';
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
  /** Stretches the button to the width of its parent. */
  fullWidth?: boolean;
  /** Override container style. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Variants
// ---------------------------------------------------------------------------

interface VariantStyle {
  bg: string;
  border: string;
  text: string;
  /** The 2px edge under the button that makes it read as a physical key. */
  edge: string;
  borderWidth: number;
}

/**
 * Marigold is a 2:1 contrast against white, so a marigold button carries *ink*
 * text, not white. That is both the accessible choice (8:1) and the one that
 * looks like gold foil rather than a highlighter.
 */
const VARIANT_STYLES: Record<ButtonVariant, VariantStyle> = {
  primary: {
    bg: colors.primary.amber,
    border: colors.transparent,
    text: colors.ink[900],
    edge: colors.primary.amberDark,
    borderWidth: 0,
  },
  secondary: {
    bg: colors.ink[900],
    border: colors.transparent,
    text: colors.text.onInk,
    edge: colors.black,
    borderWidth: 0,
  },
  outline: {
    bg: colors.background.surface,
    border: colors.border.default,
    text: colors.text.primary,
    edge: colors.transparent,
    borderWidth: 1.5,
  },
  ghost: {
    bg: colors.transparent,
    border: colors.transparent,
    text: colors.text.accent,
    edge: colors.transparent,
    borderWidth: 0,
  },
  danger: {
    bg: colors.error.main,
    border: colors.transparent,
    text: colors.white,
    edge: colors.error.dark,
    borderWidth: 0,
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
    height: 58,
    paddingHorizontal: spacing.xl,
    fontSize: fontSize.h4,
    lineHeight: lineHeight.h4,
  },
};

/** How far the key travels down when pressed. */
const KEY_TRAVEL = 2;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<Button>` — the primary call to action.
 *
 * Filled variants sit on a 2px darker edge and travel down onto it when
 * pressed, so tapping feels like pressing a key rather than fading a
 * rectangle. Haptics fire on press, a spinner doubles as the double-submit
 * guard, and a 400ms debounce guards the rest.
 *
 * ```tsx
 * <Button variant="primary" onPress={placeOrder} loading={placing} fullWidth>
 *   Place order
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
  fullWidth = false,
  style,
}: ButtonProps) {
  const scale = useSharedValue(1);
  const depth = useSharedValue(0);
  const isInteractive = !disabled && !loading;
  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle = SIZE_STYLES[size];
  const hasEdge = variantStyle.edge !== colors.transparent;

  // Guards rapid double-taps that slip past the loading flag.
  const lastPressRef = useRef(0);

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(pressScale.button, spring.press);
    depth.value = withSpring(1, spring.press);
  }, [scale, depth]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, spring.press);
    depth.value = withSpring(0, spring.press);
  }, [scale, depth]);

  const handlePress = useCallback(() => {
    if (!isInteractive) return;
    const now = Date.now();
    if (now - lastPressRef.current < 400) return;
    lastPressRef.current = now;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }, [isInteractive, onPress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateY: depth.value * KEY_TRAVEL },
    ],
  }));

  const containerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Math.max(sizeStyle.height, MIN_TAP_SIZE),
    paddingHorizontal: sizeStyle.paddingHorizontal,
    borderRadius: radius.md,
    borderWidth: variantStyle.borderWidth,
    borderColor: variantStyle.border,
    backgroundColor: variantStyle.bg,
    gap: spacing.sm,
  };

  // Hides the label behind the spinner without collapsing the button's width.
  const labelColor = loading ? colors.transparent : variantStyle.text;

  const button = (
    <AnimatedPressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      disabled={!isInteractive}
      accessibilityRole="button"
      accessibilityLabel={children}
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      style={[animatedStyle, containerStyle]}
    >
      {leftIcon && !loading && leftIcon}

      <Text
        variant="bodyBold"
        color={labelColor}
        numberOfLines={1}
        style={{
          fontFamily: fontFamily.bodyBold,
          fontSize: sizeStyle.fontSize,
          lineHeight: sizeStyle.lineHeight,
          letterSpacing: 0.1,
        }}
      >
        {children}
      </Text>

      {loading && (
        <ActivityIndicator
          color={variantStyle.text}
          size="small"
          style={StyleSheet.absoluteFill}
        />
      )}

      {rightIcon && !loading && rightIcon}
    </AnimatedPressable>
  );

  // Every variant gets the wrapper, edge or not, so that a row of mixed
  // buttons lines up: the 2px of travel has to be reserved either way.
  return (
    <View
      style={[
        styles.keyWrapper,
        { alignSelf: fullWidth ? 'stretch' : 'flex-start', opacity: disabled ? 0.4 : 1 },
        style,
      ]}
    >
      {hasEdge && (
        <View
          style={[
            styles.edge,
            { backgroundColor: variantStyle.edge, borderRadius: radius.md },
          ]}
        />
      )}
      {button}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  keyWrapper: {
    paddingBottom: KEY_TRAVEL,
  },
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: KEY_TRAVEL,
    bottom: 0,
  },
});

export default Button;
