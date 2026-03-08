import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { type AnimationObject } from 'lottie-react-native';

import { colors, spacing } from '@/theme';
import { Text } from '@/components/ui/Text';
import { LottieWrapper } from '@/components/animation/LottieWrapper';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmptyStateAction {
  /** Button label. */
  label: string;
  /** Button press handler. */
  onPress: () => void;
}

export interface EmptyStateProps {
  /** Heading text. */
  title: string;
  /** Descriptive message shown below the title. */
  message?: string;
  /**
   * Optional Lottie animation source displayed above the text.
   * Pass the return value of `require('./anim.json')`.
   */
  lottieSource?: AnimationObject | string;
  /** Optional action button rendered below the message. */
  action?: EmptyStateAction;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<EmptyState>` — a centred placeholder for empty lists and screens.
 *
 * Optionally shows a Lottie animation, a title, a descriptive message,
 * and a call-to-action button.
 *
 * ```tsx
 * <EmptyState
 *   title="No photos yet"
 *   message="Tap the camera button to take the first one!"
 *   lottieSource={require('@/assets/animations/empty-photos.json')}
 *   action={{ label: 'Take a photo', onPress: openCamera }}
 * />
 * ```
 */
export function EmptyState({
  title,
  message,
  lottieSource,
  action,
}: EmptyStateProps) {
  return (
    <View style={styles.container}>
      {lottieSource && (
        <LottieWrapper
          source={lottieSource}
          autoPlay
          loop
          style={styles.animation}
        />
      )}

      <Text variant="h3" center>
        {title}
      </Text>

      {message && (
        <Text
          variant="body"
          color={colors.text.secondary}
          center
          style={styles.message}
        >
          {message}
        </Text>
      )}

      {action && (
        <Pressable
          onPress={action.onPress}
          style={({ pressed }) => [
            styles.button,
            pressed && styles.buttonPressed,
          ]}
        >
          <Text variant="bodyBold" color={colors.white}>
            {action.label}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  animation: {
    width: 200,
    height: 200,
    marginBottom: spacing.lg,
  },
  message: {
    marginTop: spacing.sm,
  },
  button: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary.amber,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 4,
    borderRadius: 12,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
});

export default EmptyState;
