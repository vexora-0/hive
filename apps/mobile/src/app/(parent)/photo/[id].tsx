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

import Animated, { FadeInDown } from 'react-native-reanimated';

import { colors, spacing, radius, withAlpha, STALE_TIME_MS } from '@/theme';
import { Text, Button } from '@/components/ui';
import { PhotoViewer } from '@/components/media';
import { EmptyState } from '@/components/feedback';
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

  const { data: photo, isLoading, isError } = useQuery({
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
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.text.accent} />
      </View>
    );
  }

  // ---- Error / not found --------------------------------------------
  // Previously this screen fell back to the spinner above whenever `photo` was
  // absent, so a failed or refused request span forever with no way back. The
  // API answers 404 rather than 403 for a photo the parent may not see, so a
  // missing photo and a refused one are deliberately shown the same way.
  if (isError || !photo) {
    return (
      <View style={styles.errorContainer}>
        <EmptyState
          icon="image-outline"
          title="Photo unavailable"
          message="We couldn't load this photo. It may have been removed."
          action={{ label: 'Go back', onPress: handleClose }}
        />
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
      <Animated.View
        entering={FadeInDown.duration(320).delay(120)}
        style={[
          styles.bottomBar,
          { paddingBottom: Math.max(insets.bottom, spacing.md) },
        ]}
      >
        <View style={styles.bottomInfo}>
          {photo.caption && (
            <Text variant="bodyBold" onInk numberOfLines={2} style={styles.caption}>
              {photo.caption}
            </Text>
          )}

          <Text variant="bodySmall" onInk muted>
            {photo.uploadedBy.name
              ? `${formattedDate} · by ${photo.uploadedBy.name}`
              : formattedDate}
          </Text>
        </View>

        <Button
          variant="primary"
          onPress={handleOrderPrint}
          leftIcon={<Ionicons name="cart" size={17} color={colors.ink[900]} />}
        >
          Order a print
        </Button>
      </Animated.View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink[900],
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: colors.ink[900],
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The error state is paper, not ink: there is no photograph to sit behind,
  // and an EmptyState on black reads as a crash rather than a message.
  errorContainer: {
    flex: 1,
    backgroundColor: colors.background.cream,
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
    backgroundColor: withAlpha(colors.ink[700], 0.75),
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
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    backgroundColor: withAlpha(colors.ink[900], 0.92),
  },
  bottomInfo: {
    flex: 1,
    paddingBottom: spacing.sm,
  },
  caption: {
    marginBottom: spacing.xs,
  },
});
