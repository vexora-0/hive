import React, { type ReactNode } from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { type Edge } from 'react-native-safe-area-context';

import { colors, spacing, layout } from '@/theme';
import { SafeArea } from './SafeArea';
import { KeyboardAvoid } from './KeyboardAvoid';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScreenContainerProps {
  /** Screen content. */
  children: ReactNode;
  /** Wrap content in a ScrollView. @default false */
  scroll?: boolean;
  /** Wrap content in a KeyboardAvoidingView. @default false */
  keyboard?: boolean;
  /**
   * Adds bottom padding so content clears the floating tab bar. Set this on
   * any scrolling screen inside a tab group — the bar is absolutely
   * positioned, so nothing else reserves the space for it.
   * @default false
   */
  tabBarClearance?: boolean;
  /** Applies the standard horizontal screen padding to the content. */
  padded?: boolean;
  /** Style overrides applied to the inner content view. */
  style?: StyleProp<ViewStyle>;
  /**
   * Which safe-area edges to respect.
   * @default ['top', 'bottom', 'left', 'right']
   */
  edges?: Edge[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<ScreenContainer>` — the outermost component on every screen.
 *
 * Lays the paper ground, handles safe areas, and optionally scrolls, avoids
 * the keyboard and clears the floating tab bar.
 *
 * ```tsx
 * <ScreenContainer scroll padded tabBarClearance edges={['top']}>
 *   <SectionHeader title="Orders" />
 * </ScreenContainer>
 * ```
 */
export function ScreenContainer({
  children,
  scroll = false,
  keyboard = false,
  tabBarClearance = false,
  padded = false,
  style,
  edges,
}: ScreenContainerProps) {
  const paddingStyle: ViewStyle = {
    ...(padded ? { paddingHorizontal: layout.screenPaddingHorizontal } : null),
    ...(tabBarClearance ? { paddingBottom: layout.tabBarClearance } : null),
  };

  let content: ReactNode = (
    <View style={[styles.content, paddingStyle, style]}>{children}</View>
  );

  if (scroll) {
    content = (
      <ScrollView
        style={styles.scrollHost}
        contentContainerStyle={[styles.scrollContent, paddingStyle, style]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }

  if (keyboard) {
    content = <KeyboardAvoid>{content}</KeyboardAvoid>;
  }

  return <SafeArea edges={edges}>{content}</SafeArea>;
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  content: {
    flex: 1,
    backgroundColor: colors.background.cream,
  },
  scrollHost: {
    flex: 1,
    backgroundColor: colors.background.cream,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.xl,
  },
});

export default ScreenContainer;
