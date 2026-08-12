import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius, shadows, platformShadow } from '@/theme';
import { Text, Badge } from '@/components/ui';
import type { FeedPhoto } from '../services/parentService';
import type { PhotoAction } from '../hooks/usePhotoActions';
import { Modal } from '@/components/feedback';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActionOption {
  key: PhotoAction;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  badge?: string;
}

export interface PhotoActionSheetProps {
  /** The photo to act on. `null` hides the sheet. */
  photo: FeedPhoto | null;
  /** Whether the bottom sheet is visible. */
  isVisible: boolean;
  /** Called when the sheet is dismissed. */
  onClose: () => void;
  /** Called when an action is selected. */
  onAction: (action: PhotoAction, photo: FeedPhoto) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTIONS: ActionOption[] = [
  {
    key: 'viewFullScreen',
    label: 'Open full screen',
    icon: 'expand-outline',
  },
  {
    key: 'addToCart',
    label: 'Order a print',
    icon: 'cart-outline',
  },
  {
    key: 'downloadPhoto',
    label: 'Save to phone',
    icon: 'download-outline',
    disabled: true,
    badge: 'Soon',
  },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<PhotoActionSheet>` — modal actions for a selected photo: view full screen,
 * order a print, or download (coming soon). Uses RN Modal for Expo Go compatibility.
 */
export function PhotoActionSheet({
  photo,
  isVisible,
  onClose,
  onAction,
}: PhotoActionSheetProps) {
  const handleActionPress = useCallback(
    (action: PhotoAction) => {
      if (!photo) return;
      onAction(action, photo);
      onClose();
    },
    [photo, onAction, onClose],
  );

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handleIndicator} />
          <View style={styles.content}>
        {photo?.caption && (
          <Text
            variant="bodySmall"
            color={colors.text.secondary}
            numberOfLines={1}
            style={styles.photoCaption}
          >
            {photo.caption}
          </Text>
        )}

        {ACTIONS.map((action) => (
          <Pressable
            key={action.key}
            onPress={() => handleActionPress(action.key)}
            disabled={action.disabled}
            style={({ pressed }) => [
              styles.actionRow,
              pressed && styles.actionRowPressed,
              action.disabled && styles.actionRowDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <Ionicons
              name={action.icon}
              size={22}
              color={action.disabled ? colors.text.tertiary : colors.text.primary}
              style={styles.actionIcon}
            />

            <Text
              variant="body"
              color={action.disabled ? colors.text.tertiary : colors.text.primary}
              style={styles.actionLabel}
            >
              {action.label}
            </Text>

            {action.badge && (
              <Badge>{action.badge}</Badge>
            )}
          </Pressable>
        ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay.scrim,
  },
  sheet: {
    backgroundColor: colors.background.cream,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.lg,
    ...platformShadow(shadows.xlarge),
  },
  handleIndicator: {
    alignSelf: 'center',
    backgroundColor: colors.border.default,
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: spacing.ms,
    marginBottom: spacing.sm,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  photoCaption: {
    marginBottom: spacing.ms,
    paddingHorizontal: spacing.sm,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.ms,
    paddingHorizontal: spacing.ms,
    borderRadius: radius.sm,
    minHeight: 52,
  },
  actionRowPressed: {
    backgroundColor: colors.background.surfaceSecondary,
  },
  actionRowDisabled: {
    opacity: 0.55,
  },
  actionIcon: {},
  actionLabel: {
    flex: 1,
  },
});

export default PhotoActionSheet;
