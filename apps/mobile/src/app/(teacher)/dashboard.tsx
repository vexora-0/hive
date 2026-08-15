import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius, shadows, platformShadow, layout } from '@/theme';
import { ScreenContainer } from '@/components/layout';
import { ClassSelector, type ClassItem } from '@/components/forms/ClassSelector';
import { PhotoMount, MasonryGrid, PhotoViewer, type ViewerPhoto } from '@/components/media';
import { HoneycombFAB, Reveal } from '@/components/animation';
import {
  EmptyState,
  SkeletonShimmer,
  SKELETON_DELAY,
  ConfirmDialog,
  Modal,
  useToast,
} from '@/components/feedback';
import { HeaderBar } from '@/components/navigation';

import { useAuthStore } from '@/features/auth/stores/authStore';
import { useClasses } from '@/features/teacher/hooks/useClasses';
import {
  useTeacherPhotos,
  useArchivePhoto,
} from '@/features/teacher/hooks/useTeacherPhotos';
import type { Photo } from '@/features/teacher/hooks/useTeacherPhotos';

// ---------------------------------------------------------------------------
// Skeleton
//
// A skeleton earns its place only if nothing moves when the real content lands,
// so this one is built from the same parts as the screen it stands in for: the
// class selector's recessed well, then a two-column wall of *mounts* — white
// mat, sunk window at a print ratio, deeper bottom margin — rather than four
// grey rectangles at arbitrary heights. `SkeletonShimmer` waits 200ms of its
// own accord, so a cached class never flashes grey.
// ---------------------------------------------------------------------------

/** The print ratios `PhotoMount` seeds from, so the wall has the same rhythm. */
const SKELETON_RATIOS = [0.8, 1, 0.75, 0.8] as const;

/**
 * Holds its children back for the same 200ms `SkeletonShimmer` holds itself
 * back.
 *
 * The shimmering blocks already wait, but the mats they sit in are ordinary
 * views — white cards with a shadow — so a cached class painted a full wall of
 * empty frames instantly and then filled them, which is the flash the delay
 * exists to prevent. Delaying the shimmer inside an undelayed frame is half a
 * skeleton.
 */
function Delayed({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), SKELETON_DELAY);
    return () => clearTimeout(timer);
  }, []);

  return ready ? <>{children}</> : null;
}

function MountSkeleton({ ratio, index }: { ratio: number; index: number }) {
  return (
    <View style={styles.skeletonMount}>
      <View style={[styles.skeletonWindow, { aspectRatio: ratio }]}>
        {/* `delay={0}`: the wrapper above has already served the 200ms, and
            serving it twice would put the wall 400ms behind the request. */}
        <SkeletonShimmer
          width="100%"
          height="100%"
          borderRadius={radius.print}
          index={index}
          delay={0}
        />
      </View>
      <View style={styles.skeletonMargin} />
    </View>
  );
}

function DashboardSkeleton() {
  return (
    <Delayed>
      <View style={styles.skeletonContainer}>
        <SkeletonShimmer width="100%" height={52} borderRadius={radius.sm} delay={0} />

        <View style={styles.skeletonGrid}>
          <View style={styles.skeletonColumn}>
            <MountSkeleton ratio={SKELETON_RATIOS[0]} index={0} />
            <MountSkeleton ratio={SKELETON_RATIOS[2]} index={2} />
          </View>
          <View style={styles.skeletonGutter} />
          <View style={styles.skeletonColumn}>
            <MountSkeleton ratio={SKELETON_RATIOS[1]} index={1} />
            <MountSkeleton ratio={SKELETON_RATIOS[3]} index={3} />
          </View>
        </View>
      </View>
    </Delayed>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * Teacher dashboard — the wall of what this class has shared.
 *
 * Denser than the parent's album and with more affordances, because it is a
 * tool used between activities rather than something read in the evening. But
 * the object is the same: a photograph mounted on paper, at its own print
 * ratio, in two columns.
 *
 * **A photograph now answers a tap.** Until this pass the only thing a teacher
 * could do to a photo on this screen was long-press it and delete it — the
 * single most destructive action in the app was also its only interaction. A
 * tap opens the full-screen viewer, on the original file rather than the grid's
 * thumbnail, and the long-press keeps the removal behind its confirmation.
 *
 * The four states are all here: a shaped skeleton while the first page is out,
 * a failed request that says so and offers a retry, an empty class that does
 * not pretend to be a failure, and the wall itself.
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
  useEffect(() => {
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

  // ── Opening a photograph ────────────────────────────────────────────
  //
  // The viewer takes the whole page it is given, so it goes in a `Modal`: the
  // floating tab bar is drawn by the navigator, outside this screen, and an
  // absolutely-filled view inside the screen would sit underneath it. The toast
  // outlet is off — a slab of ink sliding over a photograph is exactly the
  // intrusion the viewer exists to avoid.
  //
  // Every page is handed the **original** `uri`. The wall deliberately shows
  // `thumbnailUri` because a two-column cell does not need the full file; a
  // full-screen viewer does, and serving the thumbnail here is the one mistake a
  // keepsake app cannot make.
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const viewerPhotos = useMemo<ViewerPhoto[]>(
    () =>
      photos.map((p) => ({
        id: p.id,
        uri: p.uri,
        blurhash: p.blurhash,
        caption: p.caption,
      })),
    [photos],
  );

  const handleCloseViewer = useCallback(() => setViewerIndex(null), []);

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
  //
  // `Reveal` choreographs the first screenful only and never re-fires on a
  // recycled cell; the index is pinned to 0 past the sixth row so a long wall
  // does not queue up behind its own entrance. `PhotoMount` keys its image on
  // the photo id, so a recycled cell never paints the previous child.
  const renderPhoto = useCallback(
    ({ item, index }: { item: Photo; index: number }) => (
      <Reveal index={index < 6 ? index : 0} style={styles.cell}>
        <PhotoMount
          id={item.id}
          uri={item.thumbnailUri ?? item.uri}
          blurhash={item.blurhash}
          caption={item.caption ?? undefined}
          onPress={() => setViewerIndex(index)}
          onLongPress={() => setPendingRemoval(item)}
          accessibilityLabel={
            item.caption
              ? `${item.caption}. Opens full screen. Press and hold to remove.`
              : 'Class photo. Opens full screen. Press and hold to remove.'
          }
        />
      </Reveal>
    ),
    [],
  );

  // ── Header ──────────────────────────────────────────────────────────
  //
  // **The collapsing header is deliberately not wired here**, and it is not an
  // oversight. `useHeaderScroll()` returns Reanimated's `useAnimatedScrollHandler`,
  // which is not a function at runtime — it is a `{ workletEventHandler }` ref
  // that Reanimated's own `createAnimatedComponent` unpacks. `MasonryGrid`
  // renders a bare `FlashList`, so React Native would invoke the object as a
  // scroll callback and throw on the first frame of the first scroll. The
  // wiring shown in `HeaderBar`'s docstring needs `MasonryGrid` to render
  // Reanimated's animated FlashList first; that file is not this screen's to
  // change. The large title therefore stays put, which costs a flourish and
  // saves a crash.
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

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  // ── Which empty is this? ────────────────────────────────────────────
  //
  // Three answers, and they are not interchangeable. A failed request offers a
  // retry; a teacher with no school cannot act at all and gets no button; a
  // class that simply has nothing in it yet gets the album and no button
  // either — the honeycomb key is already on screen and is the standing way to
  // put something in it, and a second CTA six inches above it would be the
  // dead-end kind. A failed fetch used to fall through to "No photos yet",
  // which invites the teacher to re-upload photos that are already there.
  const emptyState = photosError ? (
    <EmptyState
      variant="error"
      title="Couldn't load photos."
      message="Check your connection and try again."
      action={{ label: 'Try again', onPress: handleRefresh }}
    />
  ) : !hasSchool ? (
    <EmptyState
      variant="first-use"
      illustration="school"
      title="No school assigned."
      message="An administrator needs to add you to a school before you can share photos."
    />
  ) : (
    <EmptyState
      variant="first-use"
      illustration="album"
      title={
        selectedClass ? `Nothing from ${selectedClass.name} yet.` : 'Nothing shared yet.'
      }
      message="Photos you share appear here, and in the feed of every family whose child is tagged in them."
    />
  );

  // The third clause is not defensive padding. Between the class list arriving
  // and the effect above choosing a default, `selectedClassId` is still null,
  // so `useTeacherPhotos` is disabled and reports `isLoading: false` — a state
  // that is not loading and has no photos, which rendered "Nothing shared yet"
  // for a frame on every cold open of the tab.
  const isLoading =
    classesLoading ||
    photosLoading ||
    (hasSchool && classes.length > 0 && !selectedClassId);

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <HeaderBar
        large
        title="Your class"
        eyebrow={selectedClass?.name ?? undefined}
        subtitle={
          photos.length > 0
            ? `${photos.length} photo${photos.length === 1 ? '' : 's'} shared`
            : undefined
        }
      />

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
            ListEmptyComponent={emptyState}
          />

          <HoneycombFAB
            onPress={handleFABPress}
            accessibilityLabel="Share photos"
            icon={<Ionicons name="camera" size={24} color={colors.ink[900]} />}
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

          <Modal
            visible={viewerIndex !== null}
            animationType="fade"
            transparent={false}
            statusBarTranslucent
            toastOutlet={false}
            onRequestClose={handleCloseViewer}
          >
            <PhotoViewer
              photos={viewerPhotos}
              index={viewerIndex ?? 0}
              onClose={handleCloseViewer}
            />
          </Modal>
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
  cell: {
    paddingHorizontal: spacing.xs + 2,
  },
  skeletonContainer: {
    flex: 1,
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  skeletonGrid: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  skeletonColumn: {
    flex: 1,
    gap: spacing.ms,
  },
  skeletonGutter: {
    width: spacing.ms,
  },
  // The mat, matching `PhotoMount`: even margin on three sides, twice as deep
  // below, so nothing shifts when the photographs arrive.
  skeletonMount: {
    backgroundColor: colors.background.surface,
    borderRadius: radius.mount,
    padding: spacing.sm,
    paddingBottom: 0,
    ...platformShadow(shadows.medium),
  },
  skeletonWindow: {
    width: '100%',
    borderRadius: radius.print,
    overflow: 'hidden',
  },
  skeletonMargin: {
    height: spacing.md,
  },
});
