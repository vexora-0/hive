import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { STALE_TIME_MS } from '@/theme';
import { logger } from '@/utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChildWithClass {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  dateOfBirth: string | null;
  className: string | null;
  classId: string | null;
  relationship: string;
}

// ---------------------------------------------------------------------------
// Query function
// ---------------------------------------------------------------------------

async function fetchChildren(parentId: string): Promise<ChildWithClass[]> {
  const { data, error } = await supabase
    .from('parent_student_mappings')
    .select(
      `
      relationship,
      students:student_id (
        id,
        full_name,
        avatar_url,
        date_of_birth,
        class_id,
        classes:class_id (
          name
        )
      )
    `,
    )
    .eq('parent_id', parentId);

  if (error) {
    logger.error('useChildren: failed to fetch children', error);
    throw error;
  }

  if (!data) return [];

  return data.map((mapping: any) => {
    const student = mapping.students;
    return {
      id: student.id,
      fullName: student.full_name,
      avatarUrl: student.avatar_url,
      dateOfBirth: student.date_of_birth,
      className: student.classes?.name ?? null,
      classId: student.class_id,
      relationship: mapping.relationship,
    };
  });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * `useChildren` -- fetches the authenticated parent's children from
 * `parent_student_mappings` joined with `students` and `classes`.
 *
 * Also manages the currently selected child state. Defaults to the
 * first child in the list once data is loaded.
 */
export function useChildren() {
  const user = useAuthStore((s) => s.user);
  const parentId = user?.id;

  const [selectedChild, setSelectedChild] = useState<ChildWithClass | null>(
    null,
  );

  const query = useQuery({
    queryKey: ['children', parentId],
    queryFn: () => fetchChildren(parentId!),
    enabled: !!parentId,
    staleTime: STALE_TIME_MS,
  });

  // Auto-select the first child when data loads and nothing is selected yet.
  useEffect(() => {
    if (query.data && query.data.length > 0 && !selectedChild) {
      setSelectedChild(query.data[0]);
    }
  }, [query.data, selectedChild]);

  // If the selected child is removed from the list, reset to first.
  useEffect(() => {
    if (
      query.data &&
      selectedChild &&
      !query.data.find((c) => c.id === selectedChild.id)
    ) {
      setSelectedChild(query.data[0] ?? null);
    }
  }, [query.data, selectedChild]);

  const handleSelectChild = useCallback(
    (child: ChildWithClass) => {
      setSelectedChild(child);
    },
    [],
  );

  return {
    children: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    selectedChild,
    setSelectedChild: handleSelectChild,
  };
}
