import React, { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';

import { colors, spacing, radius, layout } from '@/theme';
import { ScreenContainer } from '@/components/layout/ScreenContainer';
import { HeaderBar } from '@/components/navigation/HeaderBar';
import { Text, Card, Button, Avatar, SectionHeader } from '@/components/ui';
import { HoneycombFAB } from '@/components/animation';
import {
  ConfirmDialog,
  EmptyState,
  SkeletonShimmer,
} from '@/components/feedback';
import { useClassDetail } from '@/features/admin/hooks/useClassDetail';
import { StudentCard } from '@/features/admin/components/StudentCard';
import { AssignTeacherSheet } from '@/features/admin/components/AssignTeacherSheet';
import { AddStudentSheet } from '@/features/admin/components/AddStudentSheet';
import { ParentListSheet } from '@/features/admin/components/ParentListSheet';
import type { CreateStudentData } from '@/features/admin/services/adminService';

// ---------------------------------------------------------------------------
// Skeleton — a teacher card and four child rows, at the heights they land at.
// ---------------------------------------------------------------------------

function ClassSkeleton() {
  return (
    <View style={styles.skeleton}>
      <SkeletonShimmer width="100%" height={72} borderRadius={radius.lg} />
      <View style={styles.skeletonRows}>
        {[0, 1, 2, 3].map((i) => (
          <SkeletonShimmer
            key={i}
            width="100%"
            height={64}
            borderRadius={radius.lg}
            index={i + 1}
          />
        ))}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

/**
 * One class: who teaches it, and who is in it.
 *
 * The screen is two named regions and one action. Both regions used to be
 * headed by a bare `<Text variant="eyebrow">`, which is the system's structural
 * mark used as a heading — `SectionHeader` is the one way to name a region, and
 * it owns the ramp, the gap and the trailing action so that two screens naming
 * a region agree.
 *
 * The class's year group and academic year used to sit in two marigold-washed
 * pills at a radius outside the scale, which is marigold used as a tint. They
 * are facts about the class rather than states, so they belong under its name
 * in the header, said in one line.
 *
 * The one persistent action is adding a child, and it is the app's hexagon
 * rather than the round amber circle this file used to declare inline.
 */
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
  /** Child awaiting removal confirmation. Null when no dialog is open. */
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

  // Taking a child out of a class detaches them from the teacher who
  // photographs them, so it asks first. The tap only opens the dialog.
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

  // ── Loading ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <ScreenContainer edges={['top', 'left', 'right']}>
        <HeaderBar title="Class" showBack onBack={() => router.back()} />
        <ClassSkeleton />
      </ScreenContainer>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────
  // Without this a failed fetch left a spinner running for ever.
  if (isError || !classDetail) {
    return (
      <ScreenContainer edges={['top', 'left', 'right']}>
        <HeaderBar title="Class" showBack onBack={() => router.back()} />
        <EmptyState
          variant="error"
          title="Couldn't load this class."
          message="Check your connection and try again."
          action={{ label: 'Try again', onPress: () => refetch() }}
        />
      </ScreenContainer>
    );
  }

  // ── Content ──────────────────────────────────────────────────────────
  const students = classDetail.students;
  const teacher = classDetail.teacher;
  const subtitle =
    [classDetail.grade, classDetail.academic_year].filter(Boolean).join(' · ') ||
    undefined;

  const listHeader = (
    <View>
      <SectionHeader
        size="sm"
        title="Teacher"
        action={
          teacher
            ? {
                label: 'Change',
                onPress: () => setShowTeacherSheet(true),
                accessibilityHint: 'Chooses a different teacher for this class',
              }
            : undefined
        }
        style={styles.sectionHeader}
      />

      {teacher ? (
        <Card
          row
          gap={spacing.ms}
          elevation="low"
          onPress={() => setShowTeacherSheet(true)}
          accessibilityLabel={`${teacher.full_name} teaches this class`}
          accessibilityHint="Chooses a different teacher"
          style={styles.teacherCard}
        >
          <Avatar name={teacher.full_name} size="md" />
          <View style={styles.teacherInfo}>
            <Text variant="bodyBold" numberOfLines={1}>
              {teacher.full_name}
            </Text>
            <Text variant="caption" muted numberOfLines={1}>
              {teacher.email}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={17} color={colors.text.tertiary} />
        </Card>
      ) : (
        <View style={styles.noTeacher}>
          <Text variant="bodySmall" muted style={styles.noTeacherLine}>
            Nobody can upload photographs of this class yet.
          </Text>
          <Button variant="outline" onPress={() => setShowTeacherSheet(true)}>
            Assign a teacher
          </Button>
        </View>
      )}

      <SectionHeader
        title={students.length === 1 ? '1 child' : `${students.length} children`}
        style={styles.childrenHeader}
      />
    </View>
  );

  return (
    <ScreenContainer edges={['top', 'left', 'right']}>
      <HeaderBar
        title={classDetail.name}
        subtitle={subtitle}
        showBack
        onBack={() => router.back()}
      />

      <View style={styles.container}>
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
          ListHeaderComponent={listHeader}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          // First use, and no call to action: the hexagon below is already the
          // way out, and a second button that does the same thing is the kind
          // of dead end an empty state is supposed to avoid.
          ListEmptyComponent={
            <EmptyState
              compact
              variant="first-use"
              title="No children yet."
              message="Add the children in this class, then link their parents so they can see the photographs."
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

        <HoneycombFAB
          onPress={() => setShowAddStudent(true)}
          accessibilityLabel="Add a child to this class"
          // Outline, like every other icon in the app: fill is reserved for
          // the selected state, and a filled glyph here would be the only one.
          icon={<Ionicons name="person-add-outline" size={22} color={colors.ink[900]} />}
        />
      </View>

      {/* ── Sheets ────────────────────────────────────────────────── */}
      <AssignTeacherSheet
        isVisible={showTeacherSheet}
        teachers={teachers}
        currentTeacherId={teacher?.id ?? null}
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
        title="Remove this child?"
        message={`${studentToRemove?.name ?? 'They'} will leave ${classDetail.name} and stop appearing in its photographs. They stay enrolled at the school.`}
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
  listContent: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    // Clears the floating tab bar and the hexagon above it.
    paddingBottom: layout.tabBarClearance + 72,
  },
  sectionHeader: {
    marginBottom: spacing.sm,
  },
  teacherCard: {
    alignItems: 'center',
  },
  teacherInfo: {
    flex: 1,
    gap: spacing.xxs,
  },
  noTeacher: {
    gap: spacing.sm,
  },
  noTeacherLine: {
    marginBottom: spacing.xxs,
  },
  childrenHeader: {
    marginTop: spacing.xl,
    marginBottom: spacing.ms,
  },
  separator: {
    height: spacing.sm,
  },
  skeleton: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingTop: spacing.lg,
  },
  skeletonRows: {
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
});
