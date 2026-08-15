import React, { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius, MIN_TAP_SIZE } from '@/theme';
import { Text } from '@/components/ui/Text';
import { Avatar } from '@/components/ui/Avatar';
import { BottomSheet, EmptyState } from '@/components/feedback';
import type { TeacherOption } from '@/features/admin/services/adminService';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AssignTeacherSheetProps {
  /** Whether the sheet is visible. */
  isVisible: boolean;
  /** Everyone at the school who holds the teacher role. */
  teachers: TeacherOption[];
  /** Who has the class today, or null. */
  currentTeacherId: string | null;
  /** Called when the sheet is dismissed. */
  onClose: () => void;
  /** Called with the chosen teacher, or null to leave the class unassigned. */
  onSelect: (teacherId: string | null) => void;
  /** Whether the change is in flight. */
  isSubmitting?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * `<AssignTeacherSheet>` — who has this class.
 *
 * A choice, not a form: the tap *is* the decision, so there is no Save and no
 * Cancel button underneath it. The change is reversible in the same two taps,
 * which is exactly the case the brief says should be stated rather than
 * confirmed in advance.
 *
 * Every option leads with the teacher — their photograph or their initials —
 * because a list of names in a school has duplicates in it, and an email
 * address in secondary ink is what tells two Priyas apart.
 */
export function AssignTeacherSheet({
  isVisible,
  teachers,
  currentTeacherId,
  onClose,
  onSelect,
  isSubmitting = false,
}: AssignTeacherSheetProps) {
  const handleSelect = useCallback(
    (teacherId: string | null) => {
      if (!isSubmitting) onSelect(teacherId);
    },
    [onSelect, isSubmitting],
  );

  return (
    <BottomSheet
      visible={isVisible}
      onClose={onClose}
      title="Who teaches this class?"
      subtitle="They will be able to upload and tag photographs of these children."
      scroll
      showClose
    >
      {teachers.length === 0 ? (
        <EmptyState
          compact
          variant="first-use"
          title="No teachers here yet."
          message="Give someone the teacher role under People, and they will appear in this list."
        />
      ) : (
        <View style={styles.list}>
          {teachers.map((teacher) => {
            const selected = currentTeacherId === teacher.id;
            return (
              <Pressable
                key={teacher.id}
                onPress={() => handleSelect(teacher.id)}
                disabled={isSubmitting}
                style={({ pressed }) => [
                  styles.option,
                  selected && styles.optionSelected,
                  pressed && styles.optionPressed,
                ]}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected, disabled: isSubmitting }}
                accessibilityLabel={teacher.full_name}
              >
                <Avatar name={teacher.full_name} size="sm" />

                <View style={styles.optionText}>
                  <Text variant={selected ? 'bodyBold' : 'body'} numberOfLines={1}>
                    {teacher.full_name}
                  </Text>
                  <Text variant="caption" muted numberOfLines={1}>
                    {teacher.email}
                  </Text>
                </View>

                {selected && (
                  <Ionicons name="checkmark" size={19} color={colors.text.accent} />
                )}
              </Pressable>
            );
          })}

          {/* Unassigning is a correction rather than a choice, so it sits under
              the list in quieter ink instead of competing at the top of it. */}
          {currentTeacherId !== null && (
            <Pressable
              onPress={() => handleSelect(null)}
              disabled={isSubmitting}
              style={({ pressed }) => [styles.unassign, pressed && styles.optionPressed]}
              accessibilityRole="button"
              accessibilityLabel="Leave this class without a teacher"
            >
              <Text variant="bodySmallBold" muted>
                Leave it unassigned
              </Text>
            </Pressable>
          )}
        </View>
      )}
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
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    paddingHorizontal: spacing.ms,
    paddingVertical: spacing.sm,
    minHeight: MIN_TAP_SIZE,
    borderRadius: radius.sm,
  },
  optionSelected: {
    backgroundColor: colors.background.surfaceSecondary,
  },
  optionPressed: {
    backgroundColor: colors.gray[100],
  },
  optionText: {
    flex: 1,
    gap: spacing.xxs,
  },
  unassign: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: MIN_TAP_SIZE,
    marginTop: spacing.xs,
  },
});

export default AssignTeacherSheet;
