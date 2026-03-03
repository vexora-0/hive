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
import { SkeletonShimmer } from '@/components/feedback';
import { EmptyState } from '@/components/feedback';
import { HeaderBar } from '@/components/navigation';

import { useClasses } from '@/features/teacher/hooks/useClasses';
import { useTeacherPhotos } from '@/features/teacher/hooks/useTeacherPhotos';
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
  const { classes, isLoading: classesLoading } = useClasses();
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  const handleClassSelect = useCallback((cls: ClassItem) => {
    setSelectedClassId(cls.id);
  }, []);

  // Auto-select first class when classes load
  React.useEffect(() => {
    if (classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  // ── Photos ──────────────────────────────────────────────────────────
  const {
    photos,
    fetchNextPage,
    hasNextPage,
    isLoading: photosLoading,
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

  // ── Render item ─────────────────────────────────────────────────────
  const renderPhoto = useCallback(
    ({ item }: { item: Photo }) => (
      <PolaroidCard
        id={item.id}
        uri={item.thumbnailUri ?? item.uri}
        blurhash={item.blurhash}
        caption={item.caption}
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
              <EmptyState
                title="No photos yet"
                message="Tap the camera button below to upload your first photos for this class."
                action={{
                  label: 'Upload Photos',
                  onPress: handleFABPress,
                }}
              />
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
