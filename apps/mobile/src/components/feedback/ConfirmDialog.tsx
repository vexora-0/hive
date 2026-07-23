import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, spacing, layout, shadows } from '@/theme';
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
      <Pressable style={styles.backdrop} onPress={onCancel} accessibilityRole="button">
        {/* Stops a tap inside the card dismissing it. */}
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text variant="h3" style={styles.title}>
            {title}
          </Text>
          <Text variant="body" color={colors.text.secondary} style={styles.message}>
            {message}
          </Text>
          <View style={styles.actions}>
            <Button variant="outline" onPress={onCancel} style={styles.button}>
              {cancelLabel}
            </Button>
            {/* Button has no danger variant; the destructive colour is applied
                as a style override rather than widening the shared component
                for one call site. */}
            <Button
              variant="primary"
              onPress={onConfirm}
              style={[styles.button, destructive && styles.destructive]}
            >
              {confirmLabel}
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.overlay.scrim,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.background.surface,
    borderRadius: layout.cardRadius,
    padding: spacing.lg,
    ...shadows.large,
  },
  title: { marginBottom: spacing.sm },
  message: { marginBottom: spacing.lg },
  actions: { flexDirection: 'row', gap: spacing.sm },
  button: { flex: 1 },
  destructive: { backgroundColor: colors.error.main },
});
