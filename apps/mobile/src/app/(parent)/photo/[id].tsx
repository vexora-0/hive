import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, spacing, STALE_TIME_MS } from '@/theme';
import { Text, Button } from '@/components/ui';
import { PhotoViewer } from '@/components/media';
import { getPhotoDetails } from '@/features/parent/services/parentService';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * Full-screen photo viewer screen.
 *
 * Features:
 * - Pinch-to-zoom via `<PhotoViewer>`.
 * - Bottom bar showing caption, date, and an "Order Print" button.
 * - Close via the X button or swipe-down (handled by PhotoViewer).
 *
 * Route param: `id` (photo ID).
 */
export default function PhotoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: photo, isLoading } = useQuery({
    queryKey: ['photo', id],
    queryFn: () => getPhotoDetails(id!),
    enabled: !!id,
    staleTime: STALE_TIME_MS,
  });

  const handleClose = () => {
    router.back();
  };

  const handleOrderPrint = () => {
    router.push({
      pathname: '/(parent)/orders' as never,
      params: { photoId: id },
    } as never);
  };

  // ---- Loading state ------------------------------------------------
  if (isLoading || !photo) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary.amber} />
      </View>
    );
  }

  // ---- Format date --------------------------------------------------
  const formattedDate = new Date(photo.createdAt).toLocaleDateString(
    undefined,
    {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    },
  );

  return (
    <View style={styles.container}>
      {/* Photo viewer with pinch zoom */}
      <PhotoViewer
        uri={photo.uri}
        blurhash={photo.blurhash ?? undefined}
        onClose={handleClose}
      />

      {/* Close button (overlays the PhotoViewer's own close button) */}
      <Pressable
        onPress={handleClose}
        style={[styles.closeButton, { top: insets.top + spacing.sm }]}
        hitSlop={16}
        accessibilityRole="button"
        accessibilityLabel="Close photo"
      >
        <Ionicons name="close" size={24} color={colors.white} />
      </Pressable>

      {/* Bottom info bar */}
      <View
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, spacing.md) },
        ]}
      >
        <View style={styles.bottomInfo}>
          {photo.caption && (
            <Text
              variant="body"
              color={colors.white}
              numberOfLines={2}
              style={styles.caption}
            >
              {photo.caption}
            </Text>
          )}

          <Text
            variant="bodySmall"
            color={colors.gray[400]}
            style={styles.date}
          >
            {formattedDate}
          </Text>
        </View>

        <Pressable
          onPress={handleOrderPrint}
          style={({ pressed }) => [
            styles.orderButton,
            pressed && styles.orderButtonPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Order a print of this photo"
        >
          <Ionicons
            name="cart-outline"
            size={18}
            color={colors.white}
            style={styles.orderIcon}
          />
          <Text variant="bodyBold" color={colors.white}>
            Order Print
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.black,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.black,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    position: 'absolute',
    right: spacing.md,
    zIndex: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  bottomInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  caption: {
    marginBottom: spacing.xs,
  },
  date: {
    marginBottom: spacing.xs,
  },
  orderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.amber,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: 12,
    minHeight: 44,
  },
  orderButtonPressed: {
    opacity: 0.85,
  },
  orderIcon: {
    marginRight: spacing.xs,
  },
});
