import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '@/theme';
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
}

export interface HeaderBarProps {
  /** Header title text. */
  title: string;
  /** Whether to show a back arrow on the left side. @default false */
  showBack?: boolean;
  /** Handler invoked when the back arrow is pressed. */
  onBack?: () => void;
  /** Optional action rendered on the left side (overrides back arrow). */
  leftAction?: HeaderBarAction;
  /** Optional action rendered on the right side. */
  rightAction?: HeaderBarAction;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const HEADER_HEIGHT = 56;
const ICON_SIZE = 24;
const HIT_SLOP = 8;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<HeaderBar>` — custom header bar styled with the Hive theme.
 *
 * Supports a title, an optional back button, and left/right icon actions.
 *
 * ```tsx
 * <HeaderBar
 *   title="My Album"
 *   showBack
 *   onBack={() => router.back()}
 *   rightAction={{ icon: 'settings-outline', onPress: openSettings }}
 * />
 * ```
 */
export function HeaderBar({
  title,
  showBack = false,
  onBack,
  leftAction,
  rightAction,
}: HeaderBarProps) {
  // ── Left slot ────────────────────────────────────────────────────
  const renderLeft = (): ReactNode => {
    if (leftAction) {
      return (
        <Pressable
          onPress={leftAction.onPress}
          style={styles.iconButton}
          hitSlop={HIT_SLOP}
          accessibilityLabel={leftAction.accessibilityLabel}
          accessibilityRole="button"
        >
          <Ionicons
            name={leftAction.icon}
            size={ICON_SIZE}
            color={colors.text.primary}
          />
        </Pressable>
      );
    }

    if (showBack) {
      return (
        <Pressable
          onPress={onBack}
          style={styles.iconButton}
          hitSlop={HIT_SLOP}
          accessibilityLabel="Go back"
          accessibilityRole="button"
        >
          <Ionicons
            name="chevron-back"
            size={ICON_SIZE}
            color={colors.text.primary}
          />
        </Pressable>
      );
    }

    return <View style={styles.placeholder} />;
  };

  // ── Right slot ───────────────────────────────────────────────────
  const renderRight = (): ReactNode => {
    if (rightAction) {
      return (
        <Pressable
          onPress={rightAction.onPress}
          style={styles.iconButton}
          hitSlop={HIT_SLOP}
          accessibilityLabel={rightAction.accessibilityLabel}
          accessibilityRole="button"
        >
          <Ionicons
            name={rightAction.icon}
            size={ICON_SIZE}
            color={colors.text.primary}
          />
        </Pressable>
      );
    }

    return <View style={styles.placeholder} />;
  };

  return (
    <View style={styles.container}>
      {renderLeft()}

      <Text variant="h4" numberOfLines={1} style={styles.title}>
        {title}
      </Text>

      {renderRight()}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    height: HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.background.cream,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.light,
  },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    width: 44,
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
});

export default HeaderBar;
