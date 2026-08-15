import React, { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { colors, spacing, radius, layout } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { HeaderBar } from '@/components/navigation/HeaderBar';
import { EmptyState, SkeletonShimmer } from '@/components/feedback';
import { HoneycombFAB } from '@/components/animation';
import { SchoolCard } from '@/features/admin/components/SchoolCard';
import { AddSchoolSheet } from '@/features/admin/components/AddSchoolSheet';
import { AddClassSheet } from '@/features/admin/components/AddClassSheet';
import { useAdminSchools } from '@/features/admin/hooks/useAdminSchools';
import type {
  AdminSchool,
  CreateSchoolData,
  CreateClassData,
} from '@/features/admin/services/adminService';

// ---------------------------------------------------------------------------
// Skeleton
//
// Shaped like `SchoolCard`: a card of the same height and radius, three of
// them, at the same gap. The delay lives inside `SkeletonShimmer`.
// ---------------------------------------------------------------------------

function SchoolsSkeleton() {
  return (
    <View style={styles.skeletonList}>
      {[0, 1, 2].map((i) => (
        <SkeletonShimmer
          key={i}
          width="100%"
          height={148}
          borderRadius={radius.lg}
          index={i}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * Schools — the roster, from the top.
 *
 * A school is an identity object here, not a record: initials on the wash its
 * name always gets, its address underneath, and one line saying how big it is.
 * Its classes hang off it, and a class opens onto its teacher and its children.
 *
 * Three things this screen did not have and now does:
 *
 *  - **An error state.** A failed request rendered as "No schools yet", which
 *    tells an administrator their organisation is empty when in fact the
 *    network is down. Brief §9.4.
 *  - **A skeleton in the shape of the content.** It used to render `null`
 *    while loading, so the screen was blank and then abruptly full.
 *  - **The app's own FAB.** The round marigold `Pressable` declared inline here
 *    was one of two FAB idioms in the app; the hexagon is the other, and now
 *    the only one.
 */
export default function SchoolsScreen() {
  const router = useRouter();
  const {
    schools,
    isLoading,
    isError,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    createSchool,
    isCreating,
    updateSchool,
    isUpdating,
    createClass,
    isCreatingClass,
  } = useAdminSchools();

  // ── Sheet state ────────────────────────────────────────────────────
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [editingSchool, setEditingSchool] = useState<AdminSchool | null>(null);
  const [addClassSchool, setAddClassSchool] = useState<AdminSchool | null>(null);

  const handleAddPress = useCallback(() => {
    setAddSheetVisible(true);
  }, []);

  const handleAddClose = useCallback(() => {
    setAddSheetVisible(false);
  }, []);

  // Failures are reported by the toast in useAdminSchools. Catching stops the
  // rejection escaping unhandled, and keeps the sheet open so the typed values
  // survive a retry.
  const handleAddSubmit = useCallback(
    async (data: CreateSchoolData) => {
      try {
        await createSchool(data);
        setAddSheetVisible(false);
      } catch {
        // Surfaced by the hook's onError toast.
      }
    },
    [createSchool],
  );

  // ── Editing an existing school ────────────────────────────────────
  const handleEditPress = useCallback((school: AdminSchool) => {
    setEditingSchool(school);
  }, []);

  const handleEditSubmit = useCallback(
    async (data: CreateSchoolData) => {
      if (!editingSchool) return;
      try {
        await updateSchool(editingSchool.id, data);
        setEditingSchool(null);
      } catch {
        // Surfaced by the hook's onError toast; the sheet stays open so the
        // typed values survive a retry.
      }
    },
    [editingSchool, updateSchool],
  );

  const handleAddClassPress = useCallback((school: AdminSchool) => {
    setAddClassSchool(school);
  }, []);

  const handleAddClassClose = useCallback(() => {
    setAddClassSchool(null);
  }, []);

  const handleClassPress = useCallback(
    (classId: string) => {
      router.push({ pathname: '/(admin)/class-detail', params: { classId } } as never);
    },
    [router],
  );

  const handleAddClassSubmit = useCallback(
    async (data: CreateClassData) => {
      if (!addClassSchool) return;
      try {
        await createClass(addClassSchool.id, data);
        setAddClassSchool(null);
      } catch {
        // Surfaced by the hook's onError toast.
      }
    },
    [addClassSchool, createClass],
  );

  // ── List handlers ─────────────────────────────────────────────────
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: AdminSchool }) => (
      <SchoolCard
        school={item}
        onPress={handleEditPress}
        onAddClass={handleAddClassPress}
        onClassPress={handleClassPress}
      />
    ),
    [handleEditPress, handleAddClassPress, handleClassPress],
  );

  const renderSeparator = useCallback(() => <View style={styles.separator} />, []);

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator color={colors.text.accent} />
      </View>
    );
  }, [isFetchingNextPage]);

  // The four states. There is no filter on this screen, so "filtered to
  // nothing" cannot happen and is not offered — the empty state that is
  // reachable is the first-use one, and it takes no button because the FAB
  // below is already the way out.
  const renderEmpty = useCallback(() => {
    if (isLoading) return <SchoolsSkeleton />;

    if (isError) {
      return (
        <EmptyState
          variant="error"
          title="Couldn't load the schools."
          message="Check your connection and try again."
          action={{ label: 'Try again', onPress: () => refetch() }}
        />
      );
    }

    return (
      <EmptyState
        variant="first-use"
        illustration="school"
        title="No schools yet."
        message="Add the first one, then give it classes and children."
      />
    );
  }, [isLoading, isError, refetch]);

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <HeaderBar large title="Schools" eyebrow="Every site on Hive" />

      <View style={styles.container}>
        <FlashList
          data={schools}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={renderSeparator}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={colors.primary.amberDark}
              colors={[colors.primary.amberDark]}
              progressBackgroundColor={colors.background.surface}
            />
          }
          contentContainerStyle={styles.listContent}
        />

        {/* The screen's one persistent primary action. Ink on marigold, 8.08:1
            — the hexagon is a surface and the mark on it is never marigold. */}
        <HoneycombFAB
          onPress={handleAddPress}
          accessibilityLabel="Add a school"
          icon={<Ionicons name="add" size={26} color={colors.ink[900]} />}
        />
      </View>

      <AddSchoolSheet
        isVisible={addSheetVisible}
        onClose={handleAddClose}
        onSubmit={handleAddSubmit}
        isSubmitting={isCreating}
      />

      {/* The same form, seeded with what the school already is. */}
      <AddSchoolSheet
        isVisible={editingSchool !== null}
        initialValues={
          editingSchool
            ? {
                name: editingSchool.name,
                address: editingSchool.address ?? undefined,
                phone: editingSchool.phone ?? undefined,
              }
            : null
        }
        onClose={() => setEditingSchool(null)}
        onSubmit={handleEditSubmit}
        isSubmitting={isUpdating}
      />

      <AddClassSheet
        isVisible={!!addClassSchool}
        schoolName={addClassSchool?.name ?? ''}
        onClose={handleAddClassClose}
        onSubmit={handleAddClassSubmit}
        isSubmitting={isCreatingClass}
      />
    </ScreenContainer>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: spacing.sm,
    // Clears the floating tab bar and the hexagon above it.
    paddingBottom: layout.tabBarClearance + 72,
  },
  skeletonList: {
    gap: spacing.ms,
  },
  separator: {
    height: spacing.ms,
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
