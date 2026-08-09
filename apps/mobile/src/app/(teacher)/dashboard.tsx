import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '@/theme';
import { Text } from '@/components/ui';
import { ScreenContainer } from '@/components/layout';
import { ClassSelector, type ClassItem } from '@/components/forms/ClassSelector';
import { PolaroidCard } from '@/components/media';
import { MasonryGrid } from '@/components/media';
import { HoneycombFAB } from '@/components/animation';
import { EmptyState, SkeletonShimmer, ConfirmDialog, useToast } from '@/components/feedback';
import { HeaderBar } from '@/components/navigation';

import { useAuthStore } from '@/features/auth/stores/authStore';
import { useClasses } from '@/features/teacher/hooks/useClasses';
import {
  useTeacherPhotos,
  useArchivePhoto,
} from '@/features/teacher/hooks/useTeacherPhotos';
import type { Photo } from '@/features/teacher/hooks/useTeacherPhotos';

// ---------------------------------------------------------------------------
// Skeleton Placeholder
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <View style={styles.skeletonContainer}>
      {/* Class selector skeleton */}
      <SkeletonShimmer width="100%" height={44} borderRadius={12} />

      {/* Grid skeletons */}
      <View style={styles.skeletonGrid}>
        <View style={styles.skeletonColumn}>
          <SkeletonShimmer width="100%" height={180} borderRadius={8} />
          <View style={{ height: spacing.sm }} />
          <SkeletonShimmer width="100%" height={220} borderRadius={8} />
        </View>
        <View style={{ width: spacing.sm }} />
        <View style={styles.skeletonColumn}>
          <SkeletonShimmer width="100%" height={220} borderRadius={8} />
          <View style={{ height: spacing.sm }} />
          <SkeletonShimmer width="100%" height={180} borderRadius={8} />
        </View>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * Teacher Dashboard screen.
 *
 * - ClassSelector dropdown at the top to filter by class
 * - MasonryGrid of recent photos displayed as PolaroidCards
 * - HoneycombFAB in the bottom-right to navigate to the Upload tab
 * - Pull to refresh
 * - Empty state when no photos exist
 * - Skeleton loading while data is being fetched
 */
export default function DashboardScreen() {
  const router = useRouter();

  // ── Class selection ─────────────────────────────────────────────────
  const { classes, defaultClassId, isLoading: classesLoading } = useClasses();
  // useClasses is disabled without a school, so the query never runs and the
  // screen sat empty with no explanation.
  const hasSchool = useAuthStore((s) => !!s.profile?.school_id);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const handleClassSelect = useCallback((cls: ClassItem) => {
    setSelectedClassId(cls.id);
  }, []);

  // Preselect the teacher's own class once the list loads — see
  // `useClasses().defaultClassId` for why it is not simply `classes[0]`.
  React.useEffect(() => {
    if (defaultClassId && !selectedClassId) {
      setSelectedClassId(defaultClassId);
    }
  }, [defaultClassId, selectedClassId]);

  // ── Photos ──────────────────────────────────────────────────────────
  const {
    photos,
    fetchNextPage,
    hasNextPage,
    isLoading: photosLoading,
    isError: photosError,
    refetch,
  } = useTeacherPhotos(selectedClassId ?? '');

  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleEndReached = useCallback(() => {
    if (hasNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, fetchNextPage]);

  // ── FAB ─────────────────────────────────────────────────────────────
  const handleFABPress = useCallback(() => {
    router.push('/(teacher)/upload');
  }, [router]);

  // ── Removing a photo ────────────────────────────────────────────────
  // Long-press is the entry point: this is destructive and rare, so it should
  // not sit under the same tap that opens a photo.
  const toast = useToast();
  const archive = useArchivePhoto(selectedClassId ?? '');
  const [pendingRemoval, setPendingRemoval] = useState<Photo | null>(null);

  const handleConfirmRemoval = useCallback(async () => {
    const photo = pendingRemoval;
    if (!photo) return;
    setPendingRemoval(null);

    try {
      await archive.mutateAsync(photo.id);
      toast.success('Photo removed');
    } catch {
      // The hook logs the detail; the teacher needs to know it did not happen,
      // because the grid will still show the photo and that reads as success.
      toast.error('Could not remove the photo. Please try again.');
    }
  }, [pendingRemoval, archive, toast]);

  // ── Render item ─────────────────────────────────────────────────────
  const renderPhoto = useCallback(
    ({ item }: { item: Photo }) => (
      <PolaroidCard
        id={item.id}
        uri={item.thumbnailUri ?? item.uri}
        blurhash={item.blurhash}
        caption={item.caption}
        onLongPress={() => setPendingRemoval(item)}
        style={styles.polaroid}
      />
    ),
    [],
  );

  // ── Loading state ───────────────────────────────────────────────────
  const isLoading = classesLoading || photosLoading;

  // ── Header ──────────────────────────────────────────────────────────
  const header = (
    <View style={styles.header}>
      <ClassSelector
        classes={classes}
        selectedId={selectedClassId}
        onSelect={handleClassSelect}
        label="Class"
        placeholder="Select a class"
      />
    </View>
  );

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <HeaderBar title="Dashboard" />

      {isLoading ? (
        <DashboardSkeleton />
      ) : (
        <View style={styles.content}>
          <MasonryGrid
            data={photos}
            renderItem={renderPhoto}
            onEndReached={handleEndReached}
            refreshing={refreshing}
            onRefresh={handleRefresh}
            ListHeaderComponent={header}
            ListEmptyComponent={
              // A failed fetch used to fall through to "No photos yet", which
              // invites the teacher to re-upload photos that are already there.
              photosError ? (
                <EmptyState
                  title="Couldn't load photos"
                  message="Check your connection and try again."
                  action={{ label: 'Retry', onPress: handleRefresh }}
                />
              ) : hasSchool ? (
                <EmptyState
                  title="No photos yet"
                  message="Tap the camera button below to upload your first photos for this class."
                  action={{ label: 'Upload Photos', onPress: handleFABPress }}
                />
              ) : (
                <EmptyState
                  title="No school assigned"
                  message="An administrator needs to assign you to a school before you can upload photos."
                />
              )
            }
          />

          {/* Floating action button */}
          <HoneycombFAB
            onPress={handleFABPress}
            icon={
              <Ionicons
                name="camera"
                size={24}
                color={colors.white}
              />
            }
          />

          <ConfirmDialog
            visible={pendingRemoval !== null}
            title="Remove this photo?"
            message="It will disappear from your class grid and from every parent's feed. Any print order already placed for it is not affected."
            confirmLabel="Remove"
            destructive
            onConfirm={handleConfirmRemoval}
            onCancel={() => setPendingRemoval(null)}
          />
        </View>
      )}
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  content: {
    flex: 1,
  },
  header: {
    paddingBottom: spacing.md,
  },
  polaroid: {
    flex: 1,
    margin: spacing.xs,
  },
  skeletonContainer: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  skeletonGrid: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  skeletonColumn: {
    flex: 1,
  },
});
