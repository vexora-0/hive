import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius, layout } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { HeaderBar } from '@/components/navigation/HeaderBar';
import { TextInput, Chip } from '@/components/ui';
import { EmptyState, SkeletonShimmer } from '@/components/feedback';
import { UserListItem } from '@/features/admin/components/UserListItem';
import {
  UserEditSheet,
  type UserChanges,
} from '@/features/admin/components/UserEditSheet';
import { useAdminUsers } from '@/features/admin/hooks/useAdminUsers';
import { useAdminSchools } from '@/features/admin/hooks/useAdminSchools';
import type { AdminUser } from '@/features/admin/services/adminService';
import type { UserRole } from '@/types/supabase';

// ---------------------------------------------------------------------------
// Filters
//
// Four labelled pills, which is the cap. Icon-only filters and a fifth pill
// both fail for the same reason: the strip stops being readable at a glance,
// which is the only thing a filter strip has to be.
//
// **All four have to be visible at rest.** The strip used to be a horizontal
// scroller, so at 390pt the fourth pill was sliced down the middle and read
// "Adm…" — and a word cut in half is the loudest possible signal that a screen
// is broken, whether or not it scrolls. Measured at 390: the four pills wanted
// 453pt against 390 available. "Everyone" became "All" — the word the brief
// gives the same idea on the parent feed's child switcher, and 47pt narrower —
// and the pills take the denser `ms` inset a four-up strip needs, 8pt narrower
// each. That lands the strip at 372pt, inside 390 with room to spare. The
// screen's own eyebrow already says whom the list is of.
// ---------------------------------------------------------------------------

const ROLE_FILTERS: Array<{ label: string; value: UserRole | undefined }> = [
  { label: 'All', value: undefined },
  { label: 'Teachers', value: 'teacher' },
  { label: 'Parents', value: 'parent' },
  { label: 'Admins', value: 'admin' },
];

// ---------------------------------------------------------------------------
// Skeleton
//
// Shaped like `UserListItem` — a 44pt circle, then the three lines the row
// actually has: a name, an email, and the school it belongs to. At the row's
// own height, so the list does not reflow when the people land. The 200ms delay
// is served inside `SkeletonShimmer`.
// ---------------------------------------------------------------------------

function PeopleSkeleton() {
  return (
    <View>
      {Array.from({ length: 6 }).map((_, i) => (
        <View key={i} style={styles.skeletonRow}>
          <SkeletonShimmer width={44} height={44} borderRadius={radius.pill} index={i} />
          <View style={styles.skeletonText}>
            <SkeletonShimmer width="55%" height={15} borderRadius={radius.xs} index={i} />
            <SkeletonShimmer width="78%" height={13} borderRadius={radius.xs} index={i} />
            <SkeletonShimmer width="42%" height={11} borderRadius={radius.xs} index={i} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * People — everyone who has ever signed in, and the two things about them an
 * admin can change from a phone.
 *
 * Every row leads with a person: their photograph or their initials, then their
 * name, then the school they belong to. The same fields laid out as User ID /
 * Email / Role / School / Created At would read as a table export at identical
 * spacing, and that is the difference between a companion and a console.
 *
 * **This screen has no primary action, and that is deliberate.** People arrive
 * in Hive by signing in; there is no invite endpoint, so a "Add someone" button
 * would be a dead CTA — the one thing worse than no button. What the screen
 * offers instead is the search field, and a row that opens onto the only two
 * decisions there are.
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

  /** School names by id, so a row can say "Sunshine" instead of a UUID. */
  const schoolNames = useMemo(() => {
    const map = new Map<string, string>();
    schools.forEach((school) => map.set(school.id, school.name));
    return map;
  }, [schools]);

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

  /**
   * Applies both changes, in the order that leaves the account coherent if the
   * second one fails: the role first, then the school it belongs to.
   *
   * Both outcomes are announced by the toasts inside `useAdminUsers` — success
   * as well as failure — so this says nothing of its own; a third toast on top
   * of "Role updated" and "School assigned" is noise, not confirmation.
   * Catching stops the rejection escaping unhandled and leaves the sheet open,
   * because a sheet that closes on a rejected change reads as success.
   */
  const handleSave = useCallback(
    async (userId: string, changes: UserChanges) => {
      try {
        if (changes.role) {
          await updateRole(userId, changes.role);
        }
        if ('schoolId' in changes) {
          await assignSchool(userId, changes.schoolId ?? null);
        }
        handleSheetClose();
      } catch {
        // Surfaced by the hook's onError toast.
      }
    },
    [updateRole, assignSchool, handleSheetClose],
  );

  // ── Filters ───────────────────────────────────────────────────────
  const isFiltered = Boolean(search.trim() || roleFilter);

  const clearFilters = useCallback(() => {
    setSearch('');
    setRoleFilter(undefined);
  }, [setSearch, setRoleFilter]);

  // ── List handlers ─────────────────────────────────────────────────
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const renderItem = useCallback(
    ({ item }: { item: AdminUser }) => (
      <UserListItem
        user={item}
        schoolName={item.school_id ? schoolNames.get(item.school_id) : undefined}
        onPress={handleUserPress}
      />
    ),
    [handleUserPress, schoolNames],
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

  // The four states, in the order they can occur. A failed request is never
  // dressed up as an empty list, and "nothing matched your search" is never
  // dressed up as "nobody has ever signed in".
  const renderEmpty = useCallback(() => {
    if (isLoading) return <PeopleSkeleton />;

    if (isError) {
      return (
        <EmptyState
          variant="error"
          title="Couldn't load people."
          message="Check your connection and try again."
          action={{ label: 'Try again', onPress: () => refetch() }}
        />
      );
    }

    if (isFiltered) {
      return (
        <EmptyState
          variant="filtered"
          title="Nobody matched."
          message={
            search.trim()
              ? `No one here is called "${search.trim()}".`
              : 'No one holds that role yet.'
          }
          action={{ label: 'Clear filters', onPress: clearFilters }}
        />
      );
    }

    return (
      <EmptyState
        variant="first-use"
        illustration="school"
        title="Nobody here yet."
        message="Teachers, parents and admins appear the first time they sign in."
      />
    );
  }, [isLoading, isError, isFiltered, search, refetch, clearFilters]);

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <HeaderBar large title="People" eyebrow="Everyone who has signed in" />

      <View style={styles.container}>
        <View style={styles.searchContainer}>
          <TextInput
            placeholder="Search by name or email"
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
            autoCorrect={false}
            leftIcon={<Ionicons name="search" size={18} color={colors.text.tertiary} />}
          />
        </View>

        {/* A wrapping row, not a scroller: there are exactly four filters and
            there will never be a fifth, so nothing here needs to be reachable
            by dragging. At a larger text size the last pill drops to a second
            line, which is legible; sliced in half, it was not. */}
        <View style={styles.filterRow}>
          {ROLE_FILTERS.map((filter) => (
            <Chip
              key={filter.label}
              selected={roleFilter === filter.value}
              onPress={() => setRoleFilter(filter.value)}
              style={styles.filterChip}
            >
              {filter.label}
            </Chip>
          ))}
        </View>

        <FlashList
          data={users}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={renderSeparator}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={renderEmpty}
          onEndReached={handleEndReached}
          onEndReachedThreshold={0.5}
          keyboardShouldPersistTaps="handled"
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
      </View>

      <UserEditSheet
        user={selectedUser}
        isVisible={sheetVisible}
        schools={schools}
        onClose={handleSheetClose}
        onSave={handleSave}
        isSaving={isUpdatingRole || isAssigningSchool}
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
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: spacing.md,
  },
  /** Four abreast at 390pt needs the denser inset — see the note on
   *  `ROLE_FILTERS`. A pill on its own keeps the component's `md`. */
  filterChip: {
    paddingHorizontal: spacing.ms,
  },
  listContent: {
    paddingBottom: layout.tabBarClearance,
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
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingVertical: spacing.ms,
    // 93 = the real row: a 27pt name line, a 21pt email, a 17pt caption, their
    // 2pt gaps and 12pt of padding top and bottom.
    minHeight: 93,
  },
  skeletonText: {
    flex: 1,
    gap: spacing.sm,
  },
});
