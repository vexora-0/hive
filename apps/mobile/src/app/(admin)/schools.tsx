import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { colors, spacing, layout, shadows, platformShadow } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { HeaderBar } from '@/components/navigation/HeaderBar';
import { EmptyState } from '@/components/feedback/EmptyState';
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
// Screen
// ---------------------------------------------------------------------------

/**
 * Admin schools screen with an infinite-scroll list of school cards, a FAB
 * to add a new school, and an empty state placeholder.
 */
export default function SchoolsScreen() {
  const router = useRouter();
  const {
    schools,
    isLoading,
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

  // ── Add school / add class sheet state ─────────────────────────────
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

  const renderSeparator = useCallback(
    () => <View style={styles.separator} />,
    [],
  );

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator color={colors.text.accent} />
      </View>
    );
  }, [isFetchingNextPage]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <EmptyState
        icon="business-outline"
        title="No schools yet"
        message="Add a school, then create its classes and add teachers to them."
      />
    );
  }, [isLoading]);

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <HeaderBar large title="Schools" />

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

        {/* FAB */}
        <Pressable
          onPress={handleAddPress}
          style={({ pressed }) => [
            styles.fab,
            pressed && styles.fabPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Add school"
        >
          <Ionicons name="add" size={28} color={colors.ink[900]} />
        </Pressable>
      </View>

      {/* Add school bottom sheet */}
      <AddSchoolSheet
        isVisible={addSheetVisible}
        onClose={handleAddClose}
        onSubmit={handleAddSubmit}
        isSubmitting={isCreating}
      />

      {/* Edit school bottom sheet — same form, seeded with existing values */}
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

      {/* Add class sheet */}
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
    // Clears the floating tab bar and the FAB above it.
    paddingBottom: layout.tabBarClearance + 72,
  },
  separator: {
    height: spacing.ms,
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: layout.tabBarClearance,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary.amber,
    alignItems: 'center',
    justifyContent: 'center',
    ...platformShadow(shadows.large),
  },
  fabPressed: {
    backgroundColor: colors.primary.amberDark,
    transform: [{ scale: 0.94 }],
  },
});
