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

/**
 * An icon slot.
 *
 * Pass a node when you already know the colour, or a function to be handed the
 * variant's resolved label colour — which is the form to prefer, because it is
 * the only one that stays correct when the variant changes. Mixed-hue icons are
 * the category's most dating device; an icon here is the same ink as the word
 * beside it.
 */
export type ButtonIcon = React.ReactNode | ((color: string) => React.ReactNode);

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
  leftIcon?: ButtonIcon;
  /** Optional icon rendered after the label. */
  rightIcon?: ButtonIcon;
  /** Stretches the button to the width of its parent. */
  fullWidth?: boolean;
  /** Overrides the announced label. Defaults to the button's own text. */
  accessibilityLabel?: string;
  /** Announced after the label — what happens, when it is not obvious. */
  accessibilityHint?: string;
  /** Test hook. */
  testID?: string;
  /** Override container style. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Variants
//
// Every label below was measured against its own fill, not against the page:
//
//   primary    ink 900   on marigold #F0A03A —  8.08:1
//   secondary  #EDE7DD   on ink 900         — 14.09:1
//   outline    ink 900   on white           — 17.33:1
//   ghost      #9C5A10   on paper           —  5.12:1
//   danger     white     on #A32E2A         —  7.04:1
//
// The primary line is the one that matters. Marigold is 2.03:1 on paper, so a
// marigold *label* is illegible; a marigold *surface* under an ink label is the
// most readable button in the app and looks like gold foil rather than a
// highlighter. That is the whole "surface, never a label" rule in one control.
// ---------------------------------------------------------------------------

interface VariantStyle {
  bg: string;
  border: string;
  text: string;
  /** The 2px darker edge under the button that makes it read as a physical key. */
  edge: string;
  borderWidth: number;
}

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
    // Was `colors.black`. Pure #000 appears nowhere in this product — it is the
    // one value that reads as an unstyled default rather than as a decision.
    // `viewer.ground` is the only token darker than ink 900, and at 1.14:1
    // against the face the edge is deliberately quiet: on a dark key the pressed
    // read comes from the travel, not from the shadow line.
    edge: colors.viewer.ground,
    borderWidth: 0,
  },
  outline: {
    bg: colors.background.surface,
    // `border.default` measures 1.51:1 on white, which is a hairline you have to
    // hunt for. `border.dark` (1.93:1) is firmer and still warm. The control is
    // identified by its 17:1 label; the border only has to draw the key's shape.
    border: colors.border.dark,
    text: colors.text.primary,
    edge: colors.transparent,
    borderWidth: 1.5,
  },
  ghost: {
    bg: colors.transparent,
    border: colors.transparent,
    // The readable form of marigold. Never `primary.amber` — see Text.tsx.
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

/** Rapid double-taps that slip past the loading flag, in ms. */
const DOUBLE_TAP_GUARD = 400;

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Resolves an icon slot, handing a function form the label colour. */
function renderIcon(icon: ButtonIcon | undefined, color: string): React.ReactNode {
  if (typeof icon === 'function') return icon(color);
  return icon;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<Button>` — the primary call to action.
 *
 * Filled variants sit on a 2px darker edge and travel down onto it when
 * pressed, so tapping feels like pressing a key rather than fading a rectangle.
 * The wrapper reserves that 2px whether or not the variant has an edge, so a
 * row of mixed buttons still lines up on its baseline.
 *
 * The haptic fires at finger-lift rather than on press-down, because that is
 * the moment the decision is made; `danger` gets a heavier tap than the rest,
 * which is the only difference the hand can feel between "send" and "delete".
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
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}: ButtonProps) {
  const scale = useSharedValue(1);
  const depth = useSharedValue(0);
  const isInteractive = !disabled && !loading;
  const variantStyle = VARIANT_STYLES[variant];
  const sizeStyle = SIZE_STYLES[size];
  const hasEdge = variantStyle.edge !== colors.transparent;

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
    if (now - lastPressRef.current < DOUBLE_TAP_GUARD) return;
    lastPressRef.current = now;

    Haptics.impactAsync(
      variant === 'danger'
        ? Haptics.ImpactFeedbackStyle.Medium
        : Haptics.ImpactFeedbackStyle.Light,
    );
    onPress?.();
  }, [isInteractive, onPress, variant]);

  // Transform only — the scale and the 2px of travel. Nothing here springs a
  // colour or an opacity, which at ζ < 1 would clamp at 1.0 and stall.
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
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? children}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      style={[animatedStyle, containerStyle]}
    >
      {!loading && renderIcon(leftIcon, variantStyle.text)}

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

      {!loading && renderIcon(rightIcon, variantStyle.text)}
    </AnimatedPressable>
  );

  // Every variant gets the wrapper, edge or not, so that a row of mixed
  // buttons lines up: the 2px of travel has to be reserved either way.
  return (
    <View
      style={[
        styles.keyWrapper,
        {
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: disabled ? DISABLED_OPACITY : 1,
        },
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

/**
 * Disabled controls are exempt from the contrast floor, but 0.4 took the label
 * close to invisible on paper. 0.45 still reads as "off" while leaving the word
 * legible — a disabled button the user cannot read is one they cannot learn
 * from.
 */
const DISABLED_OPACITY = 0.45;

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
