import React, { type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleProp,
  StyleSheet,
  ViewStyle,
} from 'react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface KeyboardAvoidProps {
  /** Content that should shift when the keyboard appears. */
  children: ReactNode;
  /** Optional style overrides. */
  style?: StyleProp<ViewStyle>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<KeyboardAvoid>` — platform-aware keyboard-avoiding wrapper.
 *
 * - **iOS**: uses `"padding"` behaviour so the content is pushed up
 *   smoothly above the keyboard.
 * - **Android**: uses `"height"` behaviour, which works best with
 *   `android:windowSoftInputMode="adjustResize"`.
 *
 * ```tsx
 * <KeyboardAvoid>
 *   <TextInput placeholder="Type here..." />
 * </KeyboardAvoid>
 * ```
 */
export function KeyboardAvoid({ children, style }: KeyboardAvoidProps) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.container, style]}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default KeyboardAvoid;
