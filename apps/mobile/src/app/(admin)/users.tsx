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

import { colors, spacing, layout } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { HeaderBar } from '@/components/navigation/HeaderBar';
import { TextInput } from '@/components/ui/TextInput';
import { Text } from '@/components/ui/Text';
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
        <ActivityIndicator color={colors.primary.amber} />
      </View>
    );
  }, [isFetchingNextPage]);

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <HeaderBar title="Users" />

      <View style={styles.container}>
        {/* Search bar */}
        <View style={styles.searchContainer}>
          <TextInput
            placeholder="Search by name or email..."
            value={search}
            onChangeText={setSearch}
            leftIcon={
              <Ionicons
                name="search"
                size={20}
                color={colors.text.tertiary}
              />
            }
            containerStyle={styles.searchInput}
          />
        </View>

        {/* Role filter chips */}
        <View style={styles.filterRow}>
          {ROLE_FILTERS.map((filter) => {
            const isActive = roleFilter === filter.value;
            return (
              <Pressable
                key={filter.label}
                onPress={() => setRoleFilter(filter.value)}
                style={[
                  styles.chip,
                  isActive && styles.chipActive,
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Text
                  variant="captionBold"
                  color={isActive ? colors.white : colors.text.secondary}
                >
                  {filter.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

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
              tintColor={colors.primary.amber}
              colors={[colors.primary.amber]}
            />
          }
          contentContainerStyle={styles.listContent}
          // Without this the first paint and a genuinely empty result were
          // both just a blank area, with nothing to say which had happened.
          ListEmptyComponent={
            isLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator size="large" color={colors.primary.amber} />
              </View>
            ) : isError ? (
              <EmptyState
                title="Couldn't load users"
                message="Check your connection and try again."
                action={{ label: 'Retry', onPress: () => refetch() }}
              />
            ) : (
              <EmptyState
                title={search ? 'No matching users' : 'No users yet'}
                message={
                  search
                    ? `Nothing matched "${search}". Try a different name or email.`
                    : 'Users will appear here once they sign up.'
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
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  searchInput: {
    // TextInput component handles its own width
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: 9999,
    backgroundColor: colors.background.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  chipActive: {
    backgroundColor: colors.primary.amber,
    borderColor: colors.primary.amber,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  centered: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.light,
    marginHorizontal: spacing.md,
  },
  footer: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
  },
});
