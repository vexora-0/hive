import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, layout, MIN_TAP_SIZE } from '@/theme';
import { Text } from '@/components/ui/Text';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HeaderBarAction {
  /** Ionicons icon name. */
  icon: keyof typeof Ionicons.glyphMap;
  /** Press handler. */
  onPress: () => void;
  /** Optional accessibility label. */
  accessibilityLabel?: string;
  /** Shows a dot on the icon — unread, unsaved, needs attention. */
  badge?: boolean;
}

export interface HeaderBarProps {
  /** Header title. */
  title: string;
  /**
   * A small uppercase mark above the large title. Say something the title
   * cannot — a date, a count, a school name.
   */
  eyebrow?: string;
  /** A quiet line under the large title. */
  subtitle?: string;
  /**
   * Renders the title large, in the display face, below the action row.
   * Off by default so detail screens keep a conventional centred bar.
   */
  large?: boolean;
  /**
   * Scroll offset of the screen's list, in px. When provided, a large header
   * collapses into the action row as the content scrolls under it.
   */
  scrollY?: SharedValue<number>;
  /** Shows a back arrow on the left. @default false */
  showBack?: boolean;
  /** Handler for the back arrow. */
  onBack?: () => void;
  /** Left action — replaces the back arrow. */
  leftAction?: HeaderBarAction;
  /** Right action. */
  rightAction?: HeaderBarAction;
  /** Arbitrary content rendered at the right of the action row. */
  trailing?: ReactNode;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BAR_HEIGHT = 52;
const ICON_SIZE = 23;
const HIT_SLOP = 10;
/** How far the list scrolls before the large title has fully collapsed. */
const COLLAPSE_DISTANCE = 56;

// ---------------------------------------------------------------------------
// Icon button
// ---------------------------------------------------------------------------

function IconButton({ action }: { action: HeaderBarAction }) {
  return (
    <Pressable
      onPress={action.onPress}
      style={styles.iconButton}
      hitSlop={HIT_SLOP}
      accessibilityLabel={action.accessibilityLabel}
      accessibilityRole="button"
    >
      <Ionicons name={action.icon} size={ICON_SIZE} color={colors.text.primary} />
      {action.badge && <View style={styles.iconDot} />}
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<HeaderBar>` — the top of a screen.
 *
 * Two modes. Detail screens get the conventional centred bar. Top-level
 * screens pass `large`, which sets the title in the display face on its own
 * line — the one place per screen where Fraunces appears at full size.
 *
 * Pass `scrollY` from the screen's list and the large title trades places with
 * the compact one as the content scrolls up under it, so the title is never
 * lost and never takes a third of the screen either.
 *
 * ```tsx
 * const scrollY = useSharedValue(0);
 * <HeaderBar large title="Moments" eyebrow="Aarav · Sunflower" scrollY={scrollY} />
 * ```
 */
export function HeaderBar({
  title,
  eyebrow,
  subtitle,
  large = false,
  scrollY,
  showBack = false,
  onBack,
  leftAction,
  rightAction,
  trailing,
}: HeaderBarProps) {
  // ── Collapse ────────────────────────────────────────────────────────
  // Without a scrollY the header is static: the large block stays open and
  // the compact title stays hidden.
  const largeBlockStyle = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: 1, transform: [{ translateY: 0 }] };
    const t = interpolate(
      scrollY.value,
      [0, COLLAPSE_DISTANCE],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: 1 - t,
      transform: [{ translateY: -t * 10 }],
    };
  });

  const compactTitleStyle = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: 0 };
    const t = interpolate(
      scrollY.value,
      [COLLAPSE_DISTANCE * 0.55, COLLAPSE_DISTANCE],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return {
      opacity: t,
      transform: [{ translateY: (1 - t) * 8 }],
    };
  });

  // The rule only appears once content is actually sliding underneath, so a
  // screen at rest has no line across it.
  const ruleStyle = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: 0 };
    return {
      opacity: interpolate(scrollY.value, [0, 12], [0, 1], Extrapolation.CLAMP),
    };
  });

  const left = leftAction ? (
    <IconButton action={leftAction} />
  ) : showBack ? (
    <IconButton
      action={{ icon: 'chevron-back', onPress: onBack ?? (() => {}), accessibilityLabel: 'Go back' }}
    />
  ) : (
    <View style={styles.placeholder} />
  );

  const right = trailing ?? (rightAction ? <IconButton action={rightAction} /> : <View style={styles.placeholder} />);

  // ── Large ───────────────────────────────────────────────────────────
  if (large) {
    return (
      <View style={styles.largeWrapper}>
        <View style={styles.bar}>
          {leftAction || showBack ? left : <View style={styles.flexSpacer} />}

          {/* Takes the title's place only once the large one has gone. */}
          <Animated.View style={[styles.compactTitleSlot, compactTitleStyle]}>
            <Text variant="h4" numberOfLines={1} center>
              {title}
            </Text>
          </Animated.View>

          {right}
        </View>

        <Animated.View style={[styles.largeBlock, largeBlockStyle]}>
          {eyebrow && (
            <Text variant="eyebrow" color={colors.text.tertiary} style={styles.eyebrow}>
              {eyebrow}
            </Text>
          )}
          <Text variant="h1" numberOfLines={2}>
            {title}
          </Text>
          {subtitle && (
            <Text variant="bodySmall" muted style={styles.subtitle}>
              {subtitle}
            </Text>
          )}
        </Animated.View>

        <Animated.View style={[styles.rule, ruleStyle]} />
      </View>
    );
  }

  // ── Compact ─────────────────────────────────────────────────────────
  return (
    <View>
      <View style={styles.bar}>
        {left}

        <View style={styles.compactTitleSlot}>
          <Text variant="h4" numberOfLines={1} center>
            {title}
          </Text>
          {subtitle && (
            <Text variant="caption" muted numberOfLines={1} center>
              {subtitle}
            </Text>
          )}
        </View>

        {right}
      </View>
      <Animated.View style={[styles.rule, ruleStyle]} />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  largeWrapper: {
    backgroundColor: colors.background.cream,
  },
  bar: {
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.background.cream,
  },
  compactTitleSlot: {
    flex: 1,
    justifyContent: 'center',
  },
  flexSpacer: {
    width: spacing.sm,
  },
  largeBlock: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  eyebrow: {
    marginBottom: spacing.xs + 2,
  },
  subtitle: {
    marginTop: spacing.xs,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.default,
  },
  iconButton: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconDot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error.main,
    borderWidth: 1.5,
    borderColor: colors.background.cream,
  },
  placeholder: {
    width: MIN_TAP_SIZE,
  },
});

export default HeaderBar;
