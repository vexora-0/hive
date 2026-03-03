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
    .select('id, name, grade')
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
 * ```ts
 * const { classes, isLoading, error } = useClasses();
 * ```
 */
export function useClasses() {
  const profile = useAuthStore((s) => s.profile);
  const schoolId = profile?.school_id ?? '';

  const { data, isLoading, error } = useQuery({
    queryKey: ['classes', schoolId],
    queryFn: () => fetchClasses(schoolId),
    enabled: !!schoolId,
    staleTime: STALE_TIME_MS,
  });

  return {
    classes: data ?? [],
    isLoading,
    error,
  };
}
