import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';

import { colors, spacing, radius, shadows, platformShadow } from '@/theme';
import { Text, Button } from '@/components/ui';
import { Modal } from './Modal';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  /** State the consequence, not just "are you sure?". */
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Renders the confirm action in the error colour. */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation for irreversible actions.
 *
 * Removing a student from a class, unlinking a parent and changing a role all
 * fired immediately with no confirmation.
 *
 * Built on React Native's own Modal rather than @gorhom/bottom-sheet, which
 * behaves inconsistently on Android under Expo Go — the same reason
 * PhotoActionSheet does.
 */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdropHost} onPress={onCancel} accessibilityRole="button">
        <Animated.View entering={FadeIn.duration(180)} style={styles.backdrop} />

        {/* Stops a tap inside the card dismissing it. */}
        <Animated.View entering={ZoomIn.springify().damping(20).stiffness(220)}>
          <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
            <Text variant="h3" style={styles.title}>
              {title}
            </Text>
            <Text variant="body" muted style={styles.message}>
              {message}
            </Text>
            <View style={styles.actions}>
              <Button variant="outline" onPress={onCancel} style={styles.button}>
                {cancelLabel}
              </Button>
              <Button
                variant={destructive ? 'danger' : 'primary'}
                onPress={onConfirm}
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
