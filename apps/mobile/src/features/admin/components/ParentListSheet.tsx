import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius, MIN_TAP_SIZE } from '@/theme';
import { Text } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';
import {
  BottomSheet,
  ConfirmDialog,
  EmptyState,
  SkeletonShimmer,
} from '@/components/feedback';
import { useStudentParents } from '@/features/admin/hooks/useClassDetail';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ParentListSheetProps {
  /** Whether the sheet is visible. */
  isVisible: boolean;
  /** The child whose parents these are. `null` hides the sheet. */
  studentId: string | null;
  /** That child's name, for the sheet's own sentences. */
  studentName: string;
  /** Called when the sheet is dismissed. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Skeleton — three rows in the shape of the parent rows they stand in for.
// ---------------------------------------------------------------------------

function ParentsSkeleton() {
  return (
    <View style={styles.list}>
      {[0, 1, 2].map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <SkeletonShimmer width={32} height={32} borderRadius={radius.pill} index={i} />
          <View style={styles.skeletonText}>
            <SkeletonShimmer width="48%" height={14} borderRadius={radius.xs} index={i} />
            <SkeletonShimmer width="70%" height={11} borderRadius={radius.xs} index={i} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<ParentListSheet>` — who can see this child's photographs.
 *
 * This is the privacy boundary of the whole product, so the sheet says so in
 * its own title rather than calling itself "Parents" and leaving an
 * administrator to infer what linking means. Everything else follows from that:
 * a failed request shows as a failure and never as "nobody is linked", because
 * an empty list here reads as a fact about a family; and unlinking still asks
 * first, because it takes photographs of a child away from a parent who could
 * see them a moment ago.
 *
 * Two views share the sheet — the child's parents, and the search for one more.
 * The search is reached by the pinned button and left by the row at the top of
 * it, so the sheet never grows a second navigation idiom.
 */
export function ParentListSheet({
  isVisible,
  studentId,
  studentName,
  onClose,
}: ParentListSheetProps) {
  const {
    parents,
    allParents,
    isLoading,
    isError,
    isLoadingAllParents,
    refetch,
    mapParent,
    isMappingParent,
    removeParent,
    isRemovingParent,
  } = useStudentParents(isVisible ? studentId : null);

  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState('');
  /** Parent awaiting unlink confirmation. Null when no dialog is open. */
  const [parentToRemove, setParentToRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Reset when the sheet closes, so the next child opens on their own list.
  useEffect(() => {
    if (!isVisible) {
      setShowPicker(false);
      setSearch('');
      setParentToRemove(null);
    }
  }, [isVisible]);

  /** Everyone with the parent role who is not already linked to this child. */
  const availableParents = useMemo(() => {
    const mappedIds = new Set(parents.map((p) => p.parent_id));
    let filtered = allParents.filter((p) => !mappedIds.has(p.id));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q),
      );
    }
    return filtered;
  }, [allParents, parents, search]);

  const handleSelectParent = useCallback(
    async (email: string) => {
      try {
        await mapParent(email);
        setShowPicker(false);
        setSearch('');
      } catch {
        // Surfaced by the hook's onError toast, which repeats the server's own
        // words — a 409 here says the parent is already linked.
      }
    },
    [mapParent],
  );

  // Unlinking cuts a parent's access to this child's photographs, so it asks
  // first. This is the destructive case the brief keeps ConfirmDialog for.
  const handleRemoveParent = useCallback((parentId: string, name: string) => {
    setParentToRemove({ id: parentId, name });
  }, []);

  const confirmRemoveParent = useCallback(() => {
    if (parentToRemove) {
      // Not awaited — the dialog closes immediately. The catch is required:
      // removeParent returns mutateAsync, which rejects on failure, and the
      // toast has already reported it.
      removeParent(parentToRemove.id).catch(() => {});
    }
    setParentToRemove(null);
  }, [parentToRemove, removeParent]);

  // ── The two views ──────────────────────────────────────────────────
  //
  // One sheet, two sets of contents — never two sheets. Returning a different
  // `BottomSheet` element per view unmounts the native Modal and presents a
  // fresh one, so moving between a child's parents and the search for one more
  // would slide the whole surface out and back in for what is, to the person
  // holding the phone, a step inside the same panel.
  const picker = (
    <>
      <Pressable
        onPress={() => {
          setShowPicker(false);
          setSearch('');
        }}
        style={({ pressed }) => [styles.back, pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityLabel={`Back to ${studentName}'s parents`}
      >
        <Ionicons name="arrow-back" size={18} color={colors.text.accent} />
        <Text variant="bodySmallBold" color={colors.text.accent}>
          Back
        </Text>
      </Pressable>

      <TextInput
        placeholder="Search by name or email"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        autoCorrect={false}
        leftIcon={<Ionicons name="search" size={18} color={colors.text.tertiary} />}
        containerStyle={styles.search}
      />

      {isLoadingAllParents ? (
        <ParentsSkeleton />
      ) : availableParents.length === 0 ? (
        <EmptyState
          compact
          variant={search.trim() ? 'filtered' : 'first-use'}
          title={search.trim() ? 'Nobody matched.' : 'No one left to link.'}
          message={
            search.trim()
              ? `No parent here is called "${search.trim()}".`
              : `Everyone with a parent account is already linked to ${studentName}.`
          }
          action={
            search.trim()
              ? { label: 'Clear search', onPress: () => setSearch('') }
              : undefined
          }
        />
      ) : (
        <View style={styles.list}>
          {availableParents.map((parent) => (
            <Pressable
              key={parent.id}
              onPress={() => handleSelectParent(parent.email)}
              disabled={isMappingParent}
              style={({ pressed }) => [
                styles.row,
                pressed && styles.rowPressed,
                isMappingParent && styles.rowDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Link ${parent.full_name}`}
              accessibilityHint={`They will see photographs of ${studentName}`}
            >
              <Avatar uri={parent.avatar_url} name={parent.full_name} size="sm" />

              <View style={styles.rowText}>
                <Text variant="body" numberOfLines={1}>
                  {parent.full_name}
                </Text>
                <Text variant="caption" muted numberOfLines={1}>
                  {parent.email}
                </Text>
              </View>

              <Ionicons name="add" size={20} color={colors.text.accent} />
            </Pressable>
          ))}
        </View>
      )}
    </>
  );

  const linked = (
    <>
      {isLoading ? (
        <ParentsSkeleton />
      ) : isError ? (
        <EmptyState
          compact
          variant="error"
          title="Couldn't load this list."
          message="Until it loads, treat nothing here as final."
          action={{ label: 'Try again', onPress: () => refetch() }}
        />
      ) : parents.length === 0 ? (
        <EmptyState
          compact
          variant="first-use"
          title="Nobody yet."
          message={`No parent can see ${studentName}'s photographs until they are linked here.`}
        />
      ) : (
        <View style={styles.list}>
          {parents.map((parent) => (
            <View key={parent.id} style={styles.row}>
              <Avatar name={parent.full_name} size="sm" />

              <View style={styles.rowText}>
                <Text variant="body" numberOfLines={1}>
                  {parent.full_name}
                </Text>
                <Text variant="caption" muted numberOfLines={1}>
                  {parent.email} · {parent.relationship}
                </Text>
              </View>

              <Pressable
                onPress={() => handleRemoveParent(parent.parent_id, parent.full_name)}
                disabled={isRemovingParent}
                hitSlop={8}
                style={({ pressed }) => [styles.unlink, pressed && styles.unlinkPressed]}
                accessibilityRole="button"
                accessibilityLabel={`Unlink ${parent.full_name} from ${studentName}`}
              >
                <Ionicons name="close" size={19} color={colors.text.tertiary} />
              </Pressable>
            </View>
          ))}
        </View>
      )}

    </>
  );

  return (
    <BottomSheet
      visible={isVisible}
      onClose={onClose}
      title={
        showPicker ? 'Link a parent' : `Who can see ${studentName}'s photographs`
      }
      subtitle={
        showPicker
          ? `They will see every photograph ${studentName} appears in.`
          : 'Only the people below, and the teachers of their class.'
      }
      scroll
      keyboard={showPicker}
      showClose={!showPicker}
      height={showPicker ? 'full' : 'auto'}
      footer={
        showPicker ? undefined : (
          <Button
            fullWidth
            onPress={() => setShowPicker(true)}
            accessibilityHint="Opens a search for a parent to link"
          >
            Link a parent
          </Button>
        )
      }
    >
      {showPicker ? picker : linked}

      {/* Nested inside the sheet's Modal, not a sibling of it. On iOS
          RCTModalHostViewComponentView presents from `reactViewController`,
          which walks the responder chain to the *nearest* UIViewController —
          there is no topmost-VC logic. A sibling therefore presents from the
          root VC, which is already presenting this sheet, and UIKit refuses
          with "already presenting". Nested, the nearest VC is this sheet's own
          RCTFabricModalHostViewController, which is presenting nothing. */}
      <ConfirmDialog
        visible={!!parentToRemove}
        title="Unlink this parent?"
        message={`${parentToRemove?.name ?? 'They'} will stop seeing photographs of ${studentName} straight away.`}
        confirmLabel="Unlink"
        destructive
        onConfirm={confirmRemoveParent}
        onCancel={() => setParentToRemove(null)}
      />
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  list: {
    gap: spacing.xs,
    paddingBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingLeft: spacing.ms,
    paddingRight: spacing.xs,
    paddingVertical: spacing.sm,
    minHeight: MIN_TAP_SIZE,
    borderRadius: radius.sm,
  },
  rowPressed: {
    backgroundColor: colors.background.surfaceSecondary,
  },
  rowDisabled: {
    opacity: 0.55,
  },
  rowText: {
    flex: 1,
    gap: spacing.xxs,
  },
  unlink: {
    width: MIN_TAP_SIZE,
    height: MIN_TAP_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  unlinkPressed: {
    backgroundColor: colors.gray[100],
  },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    alignSelf: 'flex-start',
    paddingRight: spacing.sm,
    minHeight: MIN_TAP_SIZE,
    borderRadius: radius.sm,
  },
  search: {
    marginBottom: spacing.ms,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingHorizontal: spacing.ms,
    paddingVertical: spacing.sm,
    minHeight: MIN_TAP_SIZE,
  },
  skeletonText: {
    flex: 1,
    gap: spacing.sm,
  },
});

export default ParentListSheet;
