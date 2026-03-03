import React, { useCallback } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '@/theme';
import { Text } from '@/components/ui';
import { Badge } from '@/components/ui';
import type { FeedPhoto } from '../services/parentService';
import type { PhotoAction } from '../hooks/usePhotoActions';

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
    label: 'View Full Screen',
    icon: 'expand-outline',
  },
  {
    key: 'addToCart',
    label: 'Order Print',
    icon: 'cart-outline',
  },
  {
    key: 'downloadPhoto',
    label: 'Download',
    icon: 'download-outline',
    disabled: true,
    badge: 'Coming Soon',
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
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.background.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: spacing.lg,
  },
  handleIndicator: {
    alignSelf: 'center',
    backgroundColor: colors.gray[300],
    width: 40,
    height: 4,
    borderRadius: 2,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  photoCaption: {
    marginBottom: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    minHeight: 48,
  },
  actionRowPressed: {
    backgroundColor: colors.gray[100],
  },
  actionRowDisabled: {
    opacity: 0.6,
  },
  actionIcon: {
    marginRight: spacing.md,
  },
  actionLabel: {
    flex: 1,
  },
});

export default PhotoActionSheet;
