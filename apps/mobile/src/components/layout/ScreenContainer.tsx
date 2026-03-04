import React, { type ReactNode } from 'react';
import { ScrollView, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { type Edge } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';
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
  /** Optional style overrides applied to the inner content view. */
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
 * `<ScreenContainer>` — a composable screen wrapper that combines
 * `SafeArea`, optional `ScrollView`, and optional `KeyboardAvoidingView`.
 *
 * Use this as the outermost component on every screen to get consistent
 * safe-area handling, scrolling, and keyboard behaviour.
 *
 * ```tsx
 * <ScreenContainer scroll keyboard>
 *   <Text variant="h1">Sign Up</Text>
 *   <TextInput placeholder="Email" />
 * </ScreenContainer>
 * ```
 */
export function ScreenContainer({
  children,
  scroll = false,
  keyboard = false,
  style,
  edges,
}: ScreenContainerProps) {
  let content: ReactNode = (
    <View style={[styles.content, style]}>{children}</View>
  );

  if (scroll) {
    content = (
      <ScrollView
        contentContainerStyle={[styles.scrollContent, style]}
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
  scrollContent: {
    flexGrow: 1,
    backgroundColor: colors.background.cream,
    paddingBottom: spacing.xl,
  },
});

export default ScreenContainer;
