import React, { type ReactNode } from 'react';
import { StyleProp, StyleSheet, ViewStyle } from 'react-native';
import {
  SafeAreaView,
  type Edge,
} from 'react-native-safe-area-context';

import { colors } from '@/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SafeAreaProps {
  /** Screen content. */
  children: ReactNode;
  /** Optional style overrides for the container. */
  style?: StyleProp<ViewStyle>;
  /**
   * Which edges should respect the safe area insets.
   * @default ['top', 'bottom', 'left', 'right']
   */
  edges?: Edge[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<SafeArea>` — a themed `SafeAreaView` pre-filled with the Hive
 * cream background colour.
 *
 * Pass `edges` to control which insets are applied (e.g. omit `'bottom'`
 * on screens that have a tab bar).
 *
 * ```tsx
 * <SafeArea edges={['top']}>
 *   <FeedScreen />
 * </SafeArea>
 * ```
 */
export function SafeArea({
  children,
  style,
  edges = ['top', 'bottom', 'left', 'right'],
}: SafeAreaProps) {
  return (
    <SafeAreaView edges={edges} style={[styles.container, style]}>
      {children}
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.cream,
  },
});

export default SafeArea;
