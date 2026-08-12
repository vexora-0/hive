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

import { colors, spacing, radius, layout, shadows, platformShadow } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { HeaderBar } from '@/components/navigation/HeaderBar';
import { Text, Button, Avatar } from '@/components/ui';
import { useClassDetail } from '@/features/admin/hooks/useClassDetail';
import { StudentCard } from '@/features/admin/components/StudentCard';
import { AssignTeacherSheet } from '@/features/admin/components/AssignTeacherSheet';
import { AddStudentSheet } from '@/features/admin/components/AddStudentSheet';
import { ParentListSheet } from '@/features/admin/components/ParentListSheet';
import { ConfirmDialog, EmptyState } from '@/components/feedback';
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
    isError,
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
  if (isLoading) {
    return (
      <ScreenContainer edges={['top', 'left', 'right']}>
        <HeaderBar title="Class" showBack onBack={() => router.back()} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary.amberDark} />
        </View>
      </ScreenContainer>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────
  // Without this a failed fetch left the spinner above running forever.
  if (isError || !classDetail) {
    return (
      <ScreenContainer edges={['top', 'left', 'right']}>
        <HeaderBar title="Class" showBack onBack={() => router.back()} />
        <View style={styles.centered}>
          <EmptyState
            icon="cloud-offline-outline"
            title="Couldn't load this class"
            message="Check your connection and try again."
            action={{ label: 'Try again', onPress: () => refetch() }}
          />
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
          <Text variant="eyebrow" color={colors.text.tertiary} style={styles.sectionTitle}>
            Teacher
          </Text>

          {classDetail.teacher ? (
            <Pressable
              onPress={() => setShowTeacherSheet(true)}
              style={styles.teacherCard}
              accessibilityRole="button"
              accessibilityLabel={`Change the teacher for this class. Currently ${classDetail.teacher.full_name}.`}
            >
              <Avatar name={classDetail.teacher.full_name} size="sm" />
              <View style={styles.teacherInfo}>
                <Text variant="bodySmallBold">{classDetail.teacher.full_name}</Text>
                <Text variant="caption" color={colors.text.tertiary}>
                  {classDetail.teacher.email}
                </Text>
              </View>
              <Ionicons name="pencil-outline" size={17} color={colors.text.tertiary} />
            </Pressable>
          ) : (
            <Button variant="outline" onPress={() => setShowTeacherSheet(true)}>
              Assign a teacher
            </Button>
          )}
        </View>

        {/* Students section */}
        <View style={styles.section}>
          <Text variant="eyebrow" color={colors.text.tertiary} style={styles.sectionTitle}>
            {students.length} {students.length === 1 ? 'child' : 'children'}
          </Text>
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
            <EmptyState
              compact
              icon="person-add-outline"
              title="No children yet"
              message="Add the children in this class so their parents can be linked to them."
              action={{ label: 'Add a child', onPress: () => setShowAddStudent(true) }}
            />
          }
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

        {/* FAB: Add student */}
        <Pressable
          onPress={() => setShowAddStudent(true)}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
          accessibilityRole="button"
          accessibilityLabel="Add a child to this class"
        >
          <Ionicons name="person-add" size={22} color={colors.ink[900]} />
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
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: spacing.md,
  },
  pill: {
    paddingHorizontal: spacing.ms,
    paddingVertical: spacing.xs + 1,
    borderRadius: radius.xs,
    backgroundColor: colors.primary.amberWash,
  },
  section: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  teacherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.ms,
    padding: spacing.ms,
    backgroundColor: colors.background.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border.light,
  },
  teacherInfo: {
    flex: 1,
    gap: 1,
  },
  listContent: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: layout.tabBarClearance + 72,
  },
  separator: {
    height: spacing.sm,
  },
  fab: {
    position: 'absolute',
    right: spacing.md,
    bottom: layout.tabBarClearance,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary.amber,
    alignItems: 'center',
    justifyContent: 'center',
    ...platformShadow(shadows.large),
  },
  fabPressed: {
    backgroundColor: colors.primary.amberDark,
    transform: [{ scale: 0.94 }],
  },
});
