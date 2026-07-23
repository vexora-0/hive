import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { HeaderBar } from '@/components/navigation/HeaderBar';
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';
import { useClassDetail } from '@/features/admin/hooks/useClassDetail';
import { StudentCard } from '@/features/admin/components/StudentCard';
import { AssignTeacherSheet } from '@/features/admin/components/AssignTeacherSheet';
import { AddStudentSheet } from '@/features/admin/components/AddStudentSheet';
import { ParentListSheet } from '@/features/admin/components/ParentListSheet';
import { ConfirmDialog } from '@/components/feedback';
import type { CreateStudentData } from '@/features/admin/services/adminService';

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export default function ClassDetailScreen() {
  const { classId: id } = useLocalSearchParams<{ classId: string }>();
  const router = useRouter();

  const {
    classDetail,
    teachers,
    isLoading,
    isRefetching,
    refetch,
    assignTeacher,
    isAssigningTeacher,
    addStudent,
    isAddingStudent,
    removeStudent,
  } = useClassDetail(id ?? '');

  // ── Sheet state ──────────────────────────────────────────────────────
  const [showTeacherSheet, setShowTeacherSheet] = useState(false);
  const [showAddStudent, setShowAddStudent] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<{
    id: string;
    name: string;
  } | null>(null);
  /** Student awaiting removal confirmation. Null when no dialog is open. */
  const [studentToRemove, setStudentToRemove] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // ── Handlers ─────────────────────────────────────────────────────────
  // The mutations report their own failures through the toast in useClassDetail.
  // Catching here stops the rejection escaping as an unhandled promise, and
  // leaves the sheet open on failure so the entered values survive a retry.
  const handleAssignTeacher = useCallback(
    async (teacherId: string | null) => {
      try {
        await assignTeacher(teacherId);
        setShowTeacherSheet(false);
      } catch {
        // Surfaced by the hook's onError toast.
      }
    },
    [assignTeacher],
  );

  const handleAddStudent = useCallback(
    async (data: CreateStudentData) => {
      try {
        await addStudent(data);
        setShowAddStudent(false);
      } catch {
        // Surfaced by the hook's onError toast.
      }
    },
    [addStudent],
  );

  // Removal is irreversible from the UI, so it asks first. The tap only opens
  // the dialog; `confirmRemoveStudent` is what actually removes.
  const handleRemoveStudent = useCallback(
    (studentId: string) => {
      const student = classDetail?.students.find((s) => s.id === studentId);
      if (student) {
        setStudentToRemove({ id: student.id, name: student.full_name });
      }
    },
    [classDetail],
  );

  const confirmRemoveStudent = useCallback(() => {
    if (studentToRemove) {
      // Deliberately not awaited — the dialog closes immediately. The catch is
      // required: removeStudent returns mutateAsync, which rejects on failure,
      // and the toast has already reported it.
      removeStudent(studentToRemove.id).catch(() => {});
    }
    setStudentToRemove(null);
  }, [studentToRemove, removeStudent]);

  const handleStudentPress = useCallback(
    (studentId: string) => {
      const student = classDetail?.students.find((s) => s.id === studentId);
      if (student) {
        setSelectedStudent({ id: student.id, name: student.full_name });
      }
    },
    [classDetail],
  );

  // ── Loading state ────────────────────────────────────────────────────
  if (isLoading || !classDetail) {
    return (
      <ScreenContainer edges={['top', 'left', 'right']}>
        <HeaderBar title="Class Detail" showBack onBack={() => router.back()} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary.amber} />
        </View>
      </ScreenContainer>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────
  const students = classDetail.students;

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <HeaderBar title={classDetail.name} showBack onBack={() => router.back()} />

      <View style={styles.container}>
        {/* Class info header */}
        <View style={styles.header}>
          {classDetail.grade && (
            <View style={styles.pill}>
              <Text variant="bodySmall" color={colors.primary.amberDark}>
                {classDetail.grade}
              </Text>
            </View>
          )}
          {classDetail.academic_year && (
            <View style={styles.pill}>
              <Text variant="bodySmall" color={colors.text.secondary}>
                {classDetail.academic_year}
              </Text>
            </View>
          )}
        </View>

        {/* Teacher section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="school-outline" size={18} color={colors.text.secondary} />
            <Text variant="bodyBold" style={styles.sectionTitle}>Teacher</Text>
          </View>

          {classDetail.teacher ? (
            <Pressable onPress={() => setShowTeacherSheet(true)} style={styles.teacherCard}>
              <Ionicons name="person" size={20} color={colors.primary.amberDark} />
              <View style={styles.teacherInfo}>
                <Text variant="body">{classDetail.teacher.full_name}</Text>
                <Text variant="bodySmall" color={colors.text.secondary}>
                  {classDetail.teacher.email}
                </Text>
              </View>
              <Ionicons name="pencil-outline" size={18} color={colors.text.secondary} />
            </Pressable>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onPress={() => setShowTeacherSheet(true)}
            >
              Assign Teacher
            </Button>
          )}
        </View>

        {/* Students section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="people-outline" size={18} color={colors.text.secondary} />
            <Text variant="bodyBold" style={styles.sectionTitle}>
              Students ({students.length})
            </Text>
          </View>
        </View>

        <FlashList
          data={students}
          renderItem={({ item }) => (
            <StudentCard
              student={item}
              onPress={handleStudentPress}
              onRemove={handleRemoveStudent}
            />
          )}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <Text variant="body" color={colors.text.secondary} center style={styles.empty}>
              No students in this class yet
            </Text>
          }
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

        {/* FAB: Add student */}
        <Pressable
          onPress={() => setShowAddStudent(true)}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          accessibilityRole="button"
          accessibilityLabel="Add student"
        >
          <Ionicons name="person-add" size={24} color={colors.white} />
        </Pressable>
      </View>

      {/* Bottom sheets */}
      <AssignTeacherSheet
        isVisible={showTeacherSheet}
        teachers={teachers}
        currentTeacherId={classDetail.teacher?.id ?? null}
        onClose={() => setShowTeacherSheet(false)}
        onSelect={handleAssignTeacher}
        isSubmitting={isAssigningTeacher}
      />

      <AddStudentSheet
        isVisible={showAddStudent}
        schoolId={classDetail.school_id}
        classId={classDetail.id}
        className={classDetail.name}
        onClose={() => setShowAddStudent(false)}
        onSubmit={handleAddStudent}
        isSubmitting={isAddingStudent}
      />

      <ParentListSheet
        isVisible={!!selectedStudent}
        studentId={selectedStudent?.id ?? null}
        studentName={selectedStudent?.name ?? ''}
        onClose={() => setSelectedStudent(null)}
      />

      <ConfirmDialog
        visible={!!studentToRemove}
        title="Remove student"
        message={`Remove ${studentToRemove?.name ?? 'this student'} from ${classDetail.name}? They will stay enrolled at the school.`}
        confirmLabel="Remove"
        destructive
        onConfirm={confirmRemoveStudent}
        onCancel={() => setStudentToRemove(null)}
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  pill: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.primary.amberLight + '20',
  },
  section: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    flex: 1,
  },
  teacherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    backgroundColor: colors.background.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border.default,
  },
  teacherInfo: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl + 80,
  },
  separator: {
    height: spacing.xs,
  },
  empty: {
    paddingVertical: spacing.xl,
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
