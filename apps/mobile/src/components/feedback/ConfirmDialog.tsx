import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion, ZoomIn } from 'react-native-reanimated';

import {
  colors,
  spacing,
  radius,
  shadows,
  platformShadow,
  duration,
  spring,
} from '@/theme';
import { Text, Button } from '@/components/ui';
import { Modal } from './Modal';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  /** State the consequence, not just "are you sure?". */
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /**
   * Renders the confirm action in `error.main` — 6.67:1, and the only place in
   * the app where a filled red button is the right answer.
   */
  destructive?: boolean;
  /**
   * Shows a spinner on the confirm button and blocks both actions. Removing a
   * child or changing a role is a round trip, and a dialog that closes before
   * the server has answered is how the same removal gets sent twice.
   */
  confirmLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Confirmation for irreversible actions.
 *
 * Removing a student from a class, unlinking a parent and changing a role all
 * fired immediately with no confirmation.
 *
 * It arrives on a spring rather than a timing curve — the one place in the
 * feedback family that does — because a dialog is the app physically
 * interrupting, and a card that scales into place under `spring.sheet` (ζ=0.87,
 * settles once, ~290ms) reads as a thing arriving rather than as a rectangle
 * being faded in over the screen. The scrim behind it is a timing: springs move
 * things, timings colour them.
 *
 * Built on React Native's own Modal rather than @gorhom/bottom-sheet, which
 * behaves inconsistently on Android under Expo Go — the same reason
 * `BottomSheet` does.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  confirmLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable
        style={styles.backdropHost}
        onPress={confirmLoading ? undefined : onCancel}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      >
        <Animated.View
          entering={FadeIn.duration(duration.fast).reduceMotion(ReduceMotion.System)}
          style={styles.backdrop}
        />

        {/* Stops a tap inside the card dismissing it. */}
        <Animated.View
          entering={ZoomIn.springify()
            .damping(spring.sheet.damping)
            .stiffness(spring.sheet.stiffness)
            .mass(spring.sheet.mass)
            .reduceMotion(ReduceMotion.System)}
        >
          <Pressable
            style={styles.card}
            onPress={(e) => e.stopPropagation()}
            accessibilityViewIsModal
          >
            <Text variant="h3" accessibilityRole="header" style={styles.title}>
              {title}
            </Text>
            <Text variant="body" muted style={styles.message}>
              {message}
            </Text>
            <View style={styles.actions}>
              <Button
                variant="outline"
                onPress={onCancel}
                disabled={confirmLoading}
                style={styles.button}
              >
                {cancelLabel}
              </Button>
              <Button
                variant={destructive ? 'danger' : 'primary'}
                onPress={onConfirm}
                loading={confirmLoading}
                style={styles.button}
              >
                {confirmLabel}
              </Button>
            </View>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdropHost: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay.scrim,
  },
  card: {
    backgroundColor: colors.background.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    ...platformShadow(shadows.xlarge),
  },
  title: { marginBottom: spacing.sm },
  message: { marginBottom: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.ms },
  button: { flex: 1 },
});

export default ConfirmDialog;
