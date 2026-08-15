import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius, MIN_TAP_SIZE } from '@/theme';
import { Avatar, Button, Text, TextInput } from '@/components/ui';
import { BottomSheet } from '@/components/feedback';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StudentItem {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface StudentTaggerProps {
  /** Full list of students that can be tagged. */
  students: StudentItem[];
  /** Set of currently selected student ids. */
  selectedIds: string[];
  /** Called whenever the selection changes. */
  onSelectionChange: (selectedIds: string[]) => void;
  /** Controls bottom sheet visibility. */
  isVisible: boolean;
  /** Called when the sheet is dismissed. */
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Checkbox
// ---------------------------------------------------------------------------

interface TagCheckboxProps {
  checked: boolean;
  /** Some but not all of the rows below are selected. */
  mixed?: boolean;
}

/**
 * The tick.
 *
 * Marigold is a surface and never a label, so a selected box is a marigold
 * *fill* carrying an **ink** check — 8.08:1, the same letterpress pairing as
 * the primary button. It used to be a white check on marigold, which measures
 * about 1.9:1 and effectively disappeared under classroom light.
 *
 * Round rather than square: it sits beside a round avatar in every row, and a
 * filled circle is the selection idiom the phone's own photo apps use.
 */
function TagCheckbox({ checked, mixed = false }: TagCheckboxProps) {
  const active = checked || mixed;

  return (
    <View style={[styles.checkbox, active && styles.checkboxActive]}>
      {active && (
        <Ionicons
          name={mixed && !checked ? 'remove' : 'checkmark'}
          size={16}
          color={colors.ink[900]}
        />
      )}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<StudentTagger>` — who is in these photographs.
 *
 * This is the teacher's most-used surface: forty photos across twenty-five
 * children, several times a week. So it is dense and scannable rather than
 * decorative — a person-first row (face, then name, then the tick), a running
 * count of coverage in the sheet's own subtitle, and one pinned action.
 *
 * Selection is carried by the tick alone. A wash behind every selected row
 * would flood the sheet with marigold the moment a teacher used "select all",
 * and the eye reads a single column of ticks far faster than twenty-five
 * tinted bands.
 *
 * The chrome — scrim, radius, handle, safe-area inset, height ceiling — belongs
 * to `@/components/feedback/BottomSheet`. `height="full"` because this sheet
 * owns the screen while it is open.
 *
 * ```tsx
 * <StudentTagger
 *   students={allStudents}
 *   selectedIds={taggedIds}
 *   onSelectionChange={setTaggedIds}
 *   isVisible={showTagger}
 *   onClose={() => setShowTagger(false)}
 * />
 * ```
 */
export function StudentTagger({
  students,
  selectedIds,
  onSelectionChange,
  isVisible,
  onClose,
}: StudentTaggerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // ── Derived data ─────────────────────────────────────────────────────
  const trimmedQuery = searchQuery.trim();

  const filteredStudents = useMemo(() => {
    if (!trimmedQuery) return students;
    const q = trimmedQuery.toLowerCase();
    return students.filter((s) => s.name.toLowerCase().includes(q));
  }, [students, trimmedQuery]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const allFilteredSelected = useMemo(
    () =>
      filteredStudents.length > 0 &&
      filteredStudents.every((s) => selectedSet.has(s.id)),
    [filteredStudents, selectedSet],
  );

  const someFilteredSelected = useMemo(
    () =>
      !allFilteredSelected && filteredStudents.some((s) => selectedSet.has(s.id)),
    [allFilteredSelected, filteredStudents, selectedSet],
  );

  const handleClose = useCallback(() => {
    setSearchQuery('');
    onClose();
  }, [onClose]);

  const handleClearSearch = useCallback(() => setSearchQuery(''), []);

  // ── Selection handlers ───────────────────────────────────────────────
  const toggleStudent = useCallback(
    (studentId: string) => {
      const nextIds = selectedSet.has(studentId)
        ? selectedIds.filter((id) => id !== studentId)
        : [...selectedIds, studentId];
      onSelectionChange(nextIds);
    },
    [selectedIds, selectedSet, onSelectionChange],
  );

  const toggleSelectAll = useCallback(() => {
    if (allFilteredSelected) {
      // Deselect all filtered students
      const filteredIds = new Set(filteredStudents.map((s) => s.id));
      onSelectionChange(selectedIds.filter((id) => !filteredIds.has(id)));
    } else {
      // Select all filtered students (keep existing selections for unfiltered)
      const combined = new Set([
        ...selectedIds,
        ...filteredStudents.map((s) => s.id),
      ]);
      onSelectionChange(Array.from(combined));
    }
  }, [allFilteredSelected, filteredStudents, selectedIds, onSelectionChange]);

  // ── Renderers ────────────────────────────────────────────────────────
  const renderItem = useCallback(
    ({ item }: { item: StudentItem }) => {
      const isChecked = selectedSet.has(item.id);

      return (
        <Pressable
          onPress={() => toggleStudent(item.id)}
          style={({ pressed }) => [
            styles.studentRow,
            pressed && styles.rowPressed,
          ]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isChecked }}
          accessibilityLabel={item.name}
        >
          <Avatar uri={item.avatarUrl} name={item.name} size="sm" />

          <Text
            variant={isChecked ? 'bodyBold' : 'body'}
            color={colors.text.primary}
            numberOfLines={1}
            style={styles.studentName}
          >
            {item.name}
          </Text>

          <TagCheckbox checked={isChecked} />
        </Pressable>
      );
    },
    [selectedSet, toggleStudent],
  );

  const keyExtractor = useCallback((item: StudentItem) => item.id, []);

  // ── Render ───────────────────────────────────────────────────────────
  //
  // The search field and the select-all row sit outside the list, so they stay
  // put while a long roster scrolls under them. `contentStyle` claims the
  // remaining height for the body: the list needs a bounded parent to scroll
  // inside instead of overflowing it, and gives up the body's own horizontal
  // padding so rows can run edge to edge.
  return (
    <BottomSheet
      visible={isVisible}
      onClose={handleClose}
      title="Who is in them?"
      subtitle={
        students.length > 0
          ? `${selectedIds.length} of ${students.length} tagged`
          : undefined
      }
      showClose
      height="full"
      contentStyle={styles.sheetBody}
      footer={
        <Button fullWidth onPress={handleClose}>
          Done
        </Button>
      }
    >
      <View style={styles.searchContainer}>
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search students"
          accessibilityLabel="Search students"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          leftIcon={
            <Ionicons name="search-outline" size={18} color={colors.text.tertiary} />
          }
          rightIcon={
            trimmedQuery.length > 0 ? (
              <Pressable
                onPress={handleClearSearch}
                // 18pt glyph + 14 either side clears the 44pt target.
                hitSlop={14}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
              >
                {/* Outline, not the filled cut: fill is reserved for the
                    selected state, and clearing a search is neither. */}
                <Ionicons
                  name="close-circle-outline"
                  size={18}
                  color={colors.text.tertiary}
                />
              </Pressable>
            ) : undefined
          }
        />
      </View>

      {filteredStudents.length > 0 && (
        <>
          <Pressable
            onPress={toggleSelectAll}
            style={({ pressed }) => [styles.selectAllRow, pressed && styles.rowPressed]}
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: allFilteredSelected
                ? true
                : someFilteredSelected
                  ? 'mixed'
                  : false,
            }}
            accessibilityLabel={
              trimmedQuery ? 'Select everyone matching the search' : 'Select everyone'
            }
          >
            <Text variant="bodyBold" color={colors.text.primary} style={styles.selectAllLabel}>
              {trimmedQuery ? 'Select all matches' : 'Select everyone'}
            </Text>

            <TagCheckbox checked={allFilteredSelected} mixed={someFilteredSelected} />
          </Pressable>

          <View style={styles.separator} />
        </>
      )}

      <FlatList
        data={filteredStudents}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text variant="body" muted center>
              {trimmedQuery
                ? `Nobody in this class matches “${trimmedQuery}”.`
                : 'No students in this class yet.'}
            </Text>
            {trimmedQuery.length > 0 && (
              <Button variant="ghost" onPress={handleClearSearch} style={styles.emptyAction}>
                Clear search
              </Button>
            )}
          </View>
        }
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </BottomSheet>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const CHECKBOX_SIZE = 26;

const styles = StyleSheet.create({
  /** Claim the sheet's remaining height; the rows own their own padding. */
  sheetBody: {
    flex: 1,
    paddingHorizontal: 0,
  },
  searchContainer: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.ms,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    minHeight: MIN_TAP_SIZE,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  selectAllLabel: {
    flex: 1,
  },
  rowPressed: {
    backgroundColor: colors.background.surfaceSecondary,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.light,
    marginHorizontal: spacing.lg,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  studentName: {
    flex: 1,
  },
  checkbox: {
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.border.dark,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.surface,
  },
  checkboxActive: {
    backgroundColor: colors.primary.amber,
    borderColor: colors.primary.amber,
  },
  emptyContainer: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  emptyAction: {
    marginTop: spacing.sm,
  },
});

export default StudentTagger;
