import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/features/auth/stores/authStore';
import { logger } from '@/utils/logger';
import { STALE_TIME_MS } from '@/theme';
import type { ClassItem } from '@/components/forms/ClassSelector';

// ---------------------------------------------------------------------------
// Fetcher
// ---------------------------------------------------------------------------

async function fetchClasses(schoolId: string): Promise<ClassItem[]> {
  const { data, error } = await supabase
    .from('classes')
    .select('id, name, grade, teacher_id')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) {
    logger.error('Failed to fetch classes:', error);
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    grade: row.grade,
    teacherId: row.teacher_id,
  }));
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * `useClasses` -- fetches the active classes for the teacher's school.
 *
 * Uses React Query with stale-time caching. The query is disabled until
 * a valid `school_id` is available from the auth profile.
 *
 * Returns every active class at the school, not just the caller's own — a
 * teacher covering for a colleague has to be able to file photos under that
 * colleague's class, and the read is school-scoped server-side either way.
 * `defaultClassId` is what a screen should preselect.
 *
 * ```ts
 * const { classes, defaultClassId, isLoading, error } = useClasses();
 * ```
 */
export function useClasses() {
  const profile = useAuthStore((s) => s.profile);
  const schoolId = profile?.school_id ?? '';
  const userId = profile?.id ?? '';

  const { data, isLoading, error } = useQuery({
    queryKey: ['classes', schoolId],
    queryFn: () => fetchClasses(schoolId),
    enabled: !!schoolId,
    staleTime: STALE_TIME_MS,
  });

  const classes = useMemo(() => data ?? [], [data]);

  /**
   * The class a screen should start on: the caller's own class if they teach
   * one, otherwise the first in the list.
   *
   * Screens used to preselect `classes[0]`, and the list is ordered by name,
   * so the alphabetically-first class at the *school* won — Sarita, who
   * teaches Sunflower, was shown Marigold. Nothing was leaked (both are
   * legitimately hers to pick, and upload is school-scoped server-side) but a
   * whole batch of photos could be filed under a colleague's class unnoticed.
   *
   * `teacher_id` is nullable and an admin may teach nothing, hence the
   * fallback.
   */
  const defaultClassId = useMemo(() => {
    if (classes.length === 0) return null;
    const own = userId ? classes.find((c) => c.teacherId === userId) : undefined;
    return (own ?? classes[0]).id;
  }, [classes, userId]);

  return {
    classes,
    defaultClassId,
    isLoading,
    error,
  };
}
