import React, { useCallback } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius } from '@/theme';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import type { TeacherOption } from '@/features/admin/services/adminService';
import { Modal } from '@/components/feedback';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AssignTeacherSheetProps {
  isVisible: boolean;
  teachers: TeacherOption[];
  currentTeacherId: string | null;
  onClose: () => void;
  onSelect: (teacherId: string | null) => void;
  isSubmitting?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
    <Modal
      visible={isVisible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handleBar} />
          <View style={styles.content}>
            <Text variant="h3" style={styles.title}>
              Assign Teacher
            </Text>

            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {/* Unassign option */}
              <Pressable
                onPress={() => handleSelect(null)}
                style={[
                  styles.option,
                  currentTeacherId === null && styles.optionSelected,
                ]}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={20}
                  color={colors.text.secondary}
                />
                <View style={styles.optionText}>
                  <Text variant="body" color={colors.text.secondary}>
                    No teacher (unassign)
                  </Text>
                </View>
                {currentTeacherId === null && (
                  <Ionicons name="checkmark" size={20} color={colors.primary.amberDark} />
                )}
              </Pressable>

              {teachers.map((teacher) => (
                <Pressable
                  key={teacher.id}
                  onPress={() => handleSelect(teacher.id)}
                  style={[
                    styles.option,
                    currentTeacherId === teacher.id && styles.optionSelected,
                  ]}
                >
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color={currentTeacherId === teacher.id ? colors.primary.amberDark : colors.text.primary}
                  />
                  <View style={styles.optionText}>
                    <Text
                      variant="body"
                      color={currentTeacherId === teacher.id ? colors.primary.amberDark : colors.text.primary}
                    >
                      {teacher.full_name}
                    </Text>
                    <Text variant="bodySmall" color={colors.text.secondary}>
                      {teacher.email}
                    </Text>
                  </View>
                  {currentTeacherId === teacher.id && (
                    <Ionicons name="checkmark" size={20} color={colors.primary.amberDark} />
                  )}
                </Pressable>
              ))}

              {teachers.length === 0 && (
                <Text variant="body" color={colors.text.secondary} center style={styles.empty}>
                  No teachers available
                </Text>
              )}
            </ScrollView>

            <Button
              variant="outline"
              size="md"
              onPress={onClose}
              style={styles.cancelButton}
            >
              Cancel
            </Button>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay.scrim,
  },
  sheet: {
    backgroundColor: colors.background.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingBottom: spacing.lg,
    maxHeight: '70%',
  },
  handleBar: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border.default,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  title: {
    marginBottom: spacing.md,
  },
  list: {
    maxHeight: 300,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    marginBottom: spacing.xs,
  },
  optionSelected: {
    backgroundColor: colors.primary.amberLight + '20',
  },
  optionText: {
    flex: 1,
  },
  empty: {
    paddingVertical: spacing.xl,
  },
  cancelButton: {
    marginTop: spacing.md,
  },
});
