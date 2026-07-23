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

import { colors, spacing } from '@/theme';
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
    createClass,
    isCreatingClass,
  } = useAdminSchools();

  // ── Add school / add class sheet state ─────────────────────────────
  const [addSheetVisible, setAddSheetVisible] = useState(false);
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
        onAddClass={handleAddClassPress}
        onClassPress={handleClassPress}
      />
    ),
    [handleAddClassPress, handleClassPress],
  );

  const renderSeparator = useCallback(
    () => <View style={styles.separator} />,
    [],
  );

  const renderFooter = useCallback(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View style={styles.footer}>
        <ActivityIndicator color={colors.primary.amber} />
      </View>
    );
  }, [isFetchingNextPage]);

  const renderEmpty = useCallback(() => {
    if (isLoading) return null;
    return (
      <EmptyState
        title="No schools yet"
        message="Tap the + button to add your first school."
      />
    );
  }, [isLoading]);

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <HeaderBar title="Schools" />

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
              tintColor={colors.primary.amber}
              colors={[colors.primary.amber]}
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
          <Ionicons name="add" size={28} color={colors.white} />
        </Pressable>
      </View>

      {/* Add school bottom sheet */}
      <AddSchoolSheet
        isVisible={addSheetVisible}
        onClose={handleAddClose}
        onSubmit={handleAddSubmit}
        isSubmitting={isCreating}
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxl + 80, // extra space for FAB
  },
  separator: {
    height: spacing.sm,
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary.amber,
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  fabPressed: {
    backgroundColor: colors.primary.amberDark,
    transform: [{ scale: 0.95 }],
  },
});
