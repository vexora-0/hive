import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, layout } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { HeaderBar } from '@/components/navigation/HeaderBar';
import { TextInput, Chip } from '@/components/ui';
import { EmptyState } from '@/components/feedback';
import { UserListItem } from '@/features/admin/components/UserListItem';
import { UserEditSheet } from '@/features/admin/components/UserEditSheet';
import { useAdminUsers } from '@/features/admin/hooks/useAdminUsers';
import { useAdminSchools } from '@/features/admin/hooks/useAdminSchools';
import type { AdminUser } from '@/features/admin/services/adminService';
import type { UserRole } from '@/types/supabase';

// ---------------------------------------------------------------------------
// Filter chip configuration
// ---------------------------------------------------------------------------

const ROLE_FILTERS: Array<{ label: string; value: UserRole | undefined }> = [
  { label: 'All', value: undefined },
  { label: 'Teachers', value: 'teacher' },
  { label: 'Parents', value: 'parent' },
  { label: 'Admins', value: 'admin' },
];

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * Admin users screen with search, role filters, infinite-scroll user list,
 * and a bottom-sheet editor for updating user roles.
 */
export default function UsersScreen() {
  const {
    users,
    isLoading,
    isError,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
    search,
    setSearch,
    roleFilter,
    setRoleFilter,
    updateRole,
    isUpdatingRole,
    assignSchool,
    isAssigningSchool,
  } = useAdminUsers();

  const { schools } = useAdminSchools();

  // ── Edit sheet state ──────────────────────────────────────────────
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const handleUserPress = useCallback((user: AdminUser) => {
    setSelectedUser(user);
    setSheetVisible(true);
  }, []);

  const handleSheetClose = useCallback(() => {
    setSheetVisible(false);
    setSelectedUser(null);
  }, []);

  // Failures are reported by the toast in useAdminUsers. Catching stops the
  // rejection escaping unhandled, and leaves the sheet open on failure — a
  // sheet that closes on a rejected role change reads as success.
  const handleSaveRole = useCallback(
    async (userId: string, role: UserRole) => {
      try {
        await updateRole(userId, role);
        handleSheetClose();
      } catch {
        // Surfaced by the hook's onError toast.
      }
    },
    [updateRole, handleSheetClose],
  );

  const handleAssignSchool = useCallback(
    async (userId: string, schoolId: string | null) => {
      try {
        await assignSchool(userId, schoolId);
        handleSheetClose();
      } catch {
        // Surfaced by the hook's onError toast.
      }
    },
    [assignSchool, handleSheetClose],
  );

  // ── List handlers ─────────────────────────────────────────────────
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: AdminUser }) => (
      <UserListItem user={item} onPress={handleUserPress} />
    ),
    [handleUserPress],
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

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <HeaderBar large title="People" eyebrow="Teachers, parents and admins" />

      <View style={styles.container}>
        {/* Search bar */}
        <View style={styles.searchContainer}>
          <TextInput
            placeholder="Search by name or email"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            leftIcon={
              <Ionicons name="search" size={18} color={colors.text.tertiary} />
            }
            containerStyle={styles.searchInput}
          />
        </View>

        {/* Role filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterRow}
        >
          {ROLE_FILTERS.map((filter) => (
            <Chip
              key={filter.label}
              selected={roleFilter === filter.value}
              onPress={() => setRoleFilter(filter.value)}
            >
              {filter.label}
            </Chip>
          ))}
        </ScrollView>

        {/* User list */}
        <FlashList
          data={users}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={renderSeparator}
          ListFooterComponent={renderFooter}
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
          // Without this the first paint and a genuinely empty result were
          // both just a blank area, with nothing to say which had happened.
          ListEmptyComponent={
            isLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary.amberDark} />
              </View>
            ) : isError ? (
              <EmptyState
                icon="cloud-offline-outline"
                title="Couldn't load people"
                message="Check your connection and try again."
                action={{ label: 'Try again', onPress: () => refetch() }}
              />
            ) : (
              <EmptyState
                icon="people-outline"
                title={search ? 'Nothing matched' : 'Nobody here yet'}
                message={
                  search
                    ? `No one matched "${search}". Try a different name or email.`
                    : 'People appear here once they sign in for the first time.'
                }
              />
            )
          }
        />
      </View>

      {/* User edit bottom sheet */}
      <UserEditSheet
        user={selectedUser}
        isVisible={sheetVisible}
        schools={schools}
        onClose={handleSheetClose}
        onSaveRole={handleSaveRole}
        onAssignSchool={handleAssignSchool}
        isSavingRole={isUpdatingRole}
        isAssigningSchool={isAssigningSchool}
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
  searchContainer: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: spacing.ms,
  },
  searchInput: {
    // TextInput component handles its own width
  },
  // react-native-web gives a ScrollView flex: 1, so without this the chip row
  // stretches down the page and pushes the list to the bottom of the screen.
  // Native sizes it to content, which is why this only showed up in a browser.
  filterScroll: {
    flexGrow: 0,
    flexShrink: 0,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: spacing.md,
  },
  listContent: {
    paddingBottom: layout.tabBarClearance,
  },
  centered: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.light,
    marginHorizontal: layout.screenPaddingHorizontal,
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
