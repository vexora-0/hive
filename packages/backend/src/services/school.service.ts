import { supabaseAdmin } from '../config/supabase';
import { AppError } from '../middleware/errorHandler';
import { assertSchoolAccess } from '../middleware/roleGuard';
import type { CreateClassInput } from '../validators/school.validator';

/**
 * School-scoped reads and writes.
 *
 * Every function takes the caller and calls `assertSchoolAccess` itself rather
 * than trusting a route to have done it. The backend uses `supabaseAdmin`,
 * which bypasses row level security entirely, so the service layer is the only
 * place the school boundary is actually enforced — see CLAUDE.md §10.
 */

type Caller = { role: string; schoolId: string | null } | undefined;

export async function listClasses(schoolId: string, user: Caller) {
  assertSchoolAccess(user, schoolId);

  const { data, error } = await supabaseAdmin
    .from('classes')
    .select('id, name, grade, teacher_id, academic_year, is_active')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('name');

  if (error) {
    throw new AppError('Failed to list classes', 500, 'QUERY_FAILED');
  }
  return data;
}

export async function listStudents(
  schoolId: string,
  user: Caller,
  classId?: string,
) {
  assertSchoolAccess(user, schoolId);

  let query = supabaseAdmin
    .from('students')
    .select('id, full_name, class_id, avatar_url, date_of_birth')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .order('full_name');

  if (classId) query = query.eq('class_id', classId);

  const { data, error } = await query;
  if (error) {
    throw new AppError('Failed to list students', 500, 'QUERY_FAILED');
  }
  return data;
}

export async function createClass(
  schoolId: string,
  input: CreateClassInput,
  user: Caller,
) {
  assertSchoolAccess(user, schoolId);

  const { data, error } = await supabaseAdmin
    .from('classes')
    .insert({
      school_id: schoolId,
      name: input.name,
      grade: input.grade,
      academic_year: input.academicYear,
    })
    .select()
    .single();

  if (error) {
    throw new AppError('Failed to create class', 500, 'INSERT_FAILED');
  }
  return data;
}
