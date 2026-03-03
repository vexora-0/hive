import { useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { STALE_TIME_MS } from '@/theme';
import {
  getClassDetail,
  assignTeacher as assignTeacherApi,
  addStudentToClass as addStudentApi,
  removeStudentFromClass as removeStudentApi,
  getStudentParents,
  mapParentToStudent as mapParentApi,
  removeParentMapping as removeParentApi,
  getTeachers,
  getUsers,
  type ClassDetail,
  type StudentParent,
  type TeacherOption,
  type CreateStudentData,
  type AdminUser,
} from '@/features/admin/services/adminService';

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useClassDetail(classId: string) {
  const queryClient = useQueryClient();
  const CLASS_KEY = ['admin', 'class', classId];

  // ── Class detail query ────────────────────────────────────────────────
  const {
    data: classDetail,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<ClassDetail>({
    queryKey: CLASS_KEY,
    queryFn: () => getClassDetail(classId),
    staleTime: STALE_TIME_MS,
    enabled: !!classId,
  });

  // ── Teachers list query ───────────────────────────────────────────────
  const { data: teachers = [] } = useQuery<TeacherOption[]>({
    queryKey: ['admin', 'teachers', classDetail?.school_id],
    queryFn: () => getTeachers(classDetail?.school_id),
    staleTime: STALE_TIME_MS,
    enabled: !!classDetail?.school_id,
  });

  // ── Assign teacher mutation ───────────────────────────────────────────
  const assignTeacherMut = useMutation({
    mutationFn: (teacherId: string | null) => assignTeacherApi(classId, teacherId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLASS_KEY });
      queryClient.invalidateQueries({ queryKey: ['admin', 'schools'] });
    },
  });

  const assignTeacher = useCallback(
    (teacherId: string | null) => assignTeacherMut.mutateAsync(teacherId),
    [assignTeacherMut],
  );

  // ── Add student mutation ──────────────────────────────────────────────
  const addStudentMut = useMutation({
    mutationFn: (data: CreateStudentData) => addStudentApi(classId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLASS_KEY });
      queryClient.invalidateQueries({ queryKey: ['admin', 'schools'] });
    },
  });

  const addStudent = useCallback(
    (data: CreateStudentData) => addStudentMut.mutateAsync(data),
    [addStudentMut],
  );

  // ── Remove student mutation ───────────────────────────────────────────
  const removeStudentMut = useMutation({
    mutationFn: (studentId: string) => removeStudentApi(classId, studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CLASS_KEY });
      queryClient.invalidateQueries({ queryKey: ['admin', 'schools'] });
    },
  });

  const removeStudent = useCallback(
    (studentId: string) => removeStudentMut.mutateAsync(studentId),
    [removeStudentMut],
  );

  return {
    classDetail,
    teachers,
    isLoading,
    isRefetching,
    refetch,
    assignTeacher,
    isAssigningTeacher: assignTeacherMut.isPending,
    addStudent,
    isAddingStudent: addStudentMut.isPending,
    removeStudent,
    isRemovingStudent: removeStudentMut.isPending,
  };
}

// ---------------------------------------------------------------------------
// Student parents hook
// ---------------------------------------------------------------------------

export function useStudentParents(studentId: string | null) {
  const queryClient = useQueryClient();
  const PARENTS_KEY = ['admin', 'student-parents', studentId];

  const {
    data: parents = [],
    isLoading,
    refetch,
  } = useQuery<StudentParent[]>({
    queryKey: PARENTS_KEY,
    queryFn: () => getStudentParents(studentId!),
    staleTime: STALE_TIME_MS,
    enabled: !!studentId,
  });

  // ── All parent users (for the picker) ─────────────────────────────────
  const {
    data: allParentsData,
    isLoading: isLoadingAllParents,
  } = useQuery({
    queryKey: ['admin', 'users', 'parent'],
    queryFn: () => getUsers(undefined, 'parent', undefined, 50),
    staleTime: STALE_TIME_MS,
    enabled: !!studentId,
  });

  const allParents: AdminUser[] = allParentsData?.data ?? [];

  const mapParentMut = useMutation({
    mutationFn: ({ email, relationship }: { email: string; relationship?: string }) =>
      mapParentApi(studentId!, email, relationship),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PARENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ['admin', 'class'] });
    },
  });

  const mapParent = useCallback(
    (email: string, relationship?: string) =>
      mapParentMut.mutateAsync({ email, relationship }),
    [mapParentMut],
  );

  const removeParentMut = useMutation({
    mutationFn: (parentId: string) => removeParentApi(studentId!, parentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PARENTS_KEY });
      queryClient.invalidateQueries({ queryKey: ['admin', 'class'] });
    },
  });

  const removeParent = useCallback(
    (parentId: string) => removeParentMut.mutateAsync(parentId),
    [removeParentMut],
  );

  return {
    parents,
    allParents,
    isLoading,
    isLoadingAllParents,
    refetch,
    mapParent,
    isMappingParent: mapParentMut.isPending,
    mapParentError: mapParentMut.error,
    removeParent,
    isRemovingParent: removeParentMut.isPending,
  };
}
