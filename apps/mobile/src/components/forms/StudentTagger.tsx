import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput as RNTextInput,
  View,
} from 'react-native';

import { colors, spacing, layout, fontFamily, fontSize, lineHeight, MIN_TAP_SIZE } from '@/theme';
import { Avatar } from '@/components/ui';
import { Text } from '@/components/ui';

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
// Component
// ---------------------------------------------------------------------------

/**
 * `<StudentTagger>` -- bottom sheet for multi-selecting students to tag in
 * photos.
 *
 * Features:
 * - Search / filter input at the top.
 * - "Select All" toggle.
 * - Checkbox list with avatars and names.
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
  const searchInputRef = useRef<RNTextInput>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Derived data ─────────────────────────────────────────────────────
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase().trim();
    return students.filter((s) => s.name.toLowerCase().includes(q));
  }, [students, searchQuery]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const allFilteredSelected = useMemo(
    () =>
      filteredStudents.length > 0 &&
      filteredStudents.every((s) => selectedSet.has(s.id)),
    [filteredStudents, selectedSet],
  );

  const handleClose = useCallback(() => {
    setSearchQuery('');
    onClose();
  }, [onClose]);

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
            pressed && styles.studentRowPressed,
          ]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: isChecked }}
          accessibilityLabel={item.name}
        >
          {/* Checkbox */}
          <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
            {isChecked && (
              <Text variant="caption" color={colors.white} style={styles.checkIcon}>
                {'✓'}
              </Text>
            )}
          </View>

          {/* Avatar */}
          <Avatar uri={item.avatarUrl} name={item.name} size="sm" style={styles.studentAvatar} />

          {/* Name */}
          <Text
            variant="body"
            color={colors.text.primary}
            numberOfLines={1}
            style={styles.studentName}
          >
            {item.name}
          </Text>
        </Pressable>
      );
    },
    [selectedSet, toggleStudent],
  );

  const keyExtractor = useCallback((item: StudentItem) => item.id, []);

  const listHeader = useMemo(
    () => (
      <View>
        {/* Search input */}
        <View style={styles.searchContainer}>
          <RNTextInput
            ref={searchInputRef}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search students..."
            placeholderTextColor={colors.text.tertiary}
            selectionColor={colors.primary.amber}
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>

        {/* Select all row */}
        <Pressable
          onPress={toggleSelectAll}
          style={({ pressed }) => [
            styles.selectAllRow,
            pressed && styles.studentRowPressed,
          ]}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: allFilteredSelected }}
          accessibilityLabel="Select all students"
        >
          <View
            style={[
              styles.checkbox,
              allFilteredSelected && styles.checkboxChecked,
            ]}
          >
            {allFilteredSelected && (
              <Text variant="caption" color={colors.white} style={styles.checkIcon}>
                {'✓'}
              </Text>
            )}
          </View>
          <Text variant="bodyBold" color={colors.text.primary} style={styles.selectAllLabel}>
            Select All
          </Text>
          <Text variant="caption" color={colors.text.secondary}>
            {selectedIds.length}/{students.length}
          </Text>
        </Pressable>

        {/* Separator */}
        <View style={styles.separator} />
      </View>
    ),
    [
      searchQuery,
      toggleSelectAll,
      allFilteredSelected,
      selectedIds.length,
      students.length,
    ],
  );

  // ── Render ───────────────────────────────────────────────────────────
  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handleBar} />
          <View style={styles.sheetHeader}>
            <Text variant="h4" color={colors.text.primary}>
              Tag Students
            </Text>
            <Pressable
              onPress={handleClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Text variant="bodyBold" color={colors.primary.amber}>
                Done
              </Text>
            </Pressable>
          </View>

          <FlatList
            data={filteredStudents}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListHeaderComponent={listHeader}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text variant="body" color={colors.text.tertiary} center>
                  {searchQuery
                    ? 'No students match your search.'
                    : 'No students available.'}
                </Text>
              </View>
            }
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const CHECKBOX_SIZE = 22;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    maxHeight: '85%',
    backgroundColor: colors.background.cream,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleBar: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.gray[300],
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  list: {
    maxHeight: 400,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  searchInput: {
    height: MIN_TAP_SIZE,
    borderRadius: layout.inputRadius,
    borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.background.surface,
    paddingHorizontal: spacing.md,
    fontFamily: fontFamily.bodyRegular,
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
    color: colors.text.primary,
  },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: MIN_TAP_SIZE,
  },
  selectAllLabel: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border.light,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  studentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: MIN_TAP_SIZE,
  },
  studentRowPressed: {
    backgroundColor: colors.gray[100],
  },
  checkbox: {
    width: CHECKBOX_SIZE,
    height: CHECKBOX_SIZE,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.gray[400],
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background.surface,
  },
  checkboxChecked: {
    backgroundColor: colors.primary.amber,
    borderColor: colors.primary.amber,
  },
  checkIcon: {
    marginTop: -1,
  },
  studentAvatar: {
    marginLeft: spacing.sm,
  },
  studentName: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  emptyContainer: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
});

export default StudentTagger;
