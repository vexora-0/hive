import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';
import { AppError } from '../middleware/errorHandler';
import type {
  CreateSchoolInput,
  CreateStudentInput,
  MapParentInput,
  GetUsersInput,
  GetSchoolsInput,
} from '../validators/admin.validator';

interface DashboardStats {
  totalSchools: number;
  totalUsers: number;
  totalPhotos: number;
  totalOrders: number;
  totalRevenue: number;
}

interface UserProfile {
  id: string;
  email: string;
  role: string;
  school_id: string | null;
  full_name: string | null;
  created_at: string;
}

interface School {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  created_at: string;
}

interface PaginatedUsers {
  users: UserProfile[];
  nextCursor: string | null;
}

interface PaginatedSchools {
  schools: School[];
  nextCursor: string | null;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [schoolsCount, usersCount, photosCount, ordersResult] =
    await Promise.all([
      supabaseAdmin
        .from('schools')
        .select('id', { count: 'exact', head: true }),
      supabaseAdmin
        .from('profiles')
        .select('id', { count: 'exact', head: true }),
      supabaseAdmin
        .from('photos')
        .select('id', { count: 'exact', head: true }),
      // `total` does not exist — the column is total_amount. The error was
      // never checked, so data came back null and both figures silently
      // reported 0 regardless of the real data. (G-06)
      supabaseAdmin.from('orders').select('total_amount'),
    ]);

  for (const [name, result] of Object.entries({
    schools: schoolsCount,
    users: usersCount,
    photos: photosCount,
    orders: ordersResult,
  })) {
    if (result.error) {
      logger.error('Dashboard statistic query failed', {
        statistic: name,
        error: result.error.message,
      });
      throw new AppError('Failed to load dashboard statistics', 500, 'QUERY_FAILED');
    }
  }

  const totalOrders = ordersResult.data?.length ?? 0;
  const totalRevenue =
    ordersResult.data?.reduce(
      (sum, order) => sum + Number(order.total_amount ?? 0),
      0,
    ) ?? 0;

  return {
    totalSchools: schoolsCount.count ?? 0,
    totalUsers: usersCount.count ?? 0,
    totalPhotos: photosCount.count ?? 0,
    totalOrders,
    totalRevenue,
  };
}

export async function getUsers(
  params: GetUsersInput,
): Promise<PaginatedUsers> {
  const { search, role, cursor, limit = 20 } = params;

  let query = supabaseAdmin
    .from('profiles')
    .select('id, email, role, school_id, full_name, created_at')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (search) {
    // or() takes a comma-separated filter DSL, so an unescaped comma, bracket
    // or dot lets a caller inject an additional filter clause. Strip the
    // metacharacters rather than trusting the input. (G-16)
    const safe = search.replace(/[,().*%\\]/g, '').trim();
    if (safe) {
      query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
    }
  }

  if (role) {
    query = query.eq('role', role);
  }

  if (cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString());
      query = query.or(
        `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
      );
    } catch {
      throw new AppError('Invalid cursor', 400, 'INVALID_CURSOR');
    }
  }

  const { data: users, error } = await query;

  if (error) {
    logger.error('Failed to fetch users', { error: error.message });
    throw new AppError('Failed to fetch users', 500, 'QUERY_FAILED');
  }

  const hasNext = (users?.length ?? 0) > limit;
  const results = (users?.slice(0, limit) ?? []) as UserProfile[];

  const nextCursor =
    hasNext && results.length > 0
      ? Buffer.from(
          JSON.stringify({
            createdAt: results[results.length - 1].created_at,
            id: results[results.length - 1].id,
          }),
        ).toString('base64url')
      : null;

  return { users: results, nextCursor };
}

export async function updateUserRole(
  userId: string,
  role: string,
): Promise<UserProfile> {
  const { data: user, error } = await supabaseAdmin
    .from('profiles')
    .update({ role })
    .eq('id', userId)
    .select('id, email, role, school_id, full_name, created_at')
    .single();

  if (error) {
    logger.error('Failed to update user role', {
      error: error.message,
      userId,
      role,
    });

    if (error.code === 'PGRST116') {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    throw new AppError('Failed to update user role', 500, 'UPDATE_FAILED');
  }

  logger.info('User role updated', { userId, role });
  return user as UserProfile;
}

export async function assignUserToSchool(
  userId: string,
  schoolId: string | null,
): Promise<UserProfile> {
  const { data: user, error } = await supabaseAdmin
    .from('profiles')
    .update({ school_id: schoolId })
    .eq('id', userId)
    .select('id, email, role, school_id, full_name, created_at')
    .single();

  if (error) {
    logger.error('Failed to assign user to school', {
      error: error.message,
      userId,
      schoolId,
    });

    if (error.code === 'PGRST116') {
      throw new AppError('User not found', 404, 'USER_NOT_FOUND');
    }

    throw new AppError('Failed to assign user to school', 500, 'UPDATE_FAILED');
  }

  logger.info('User assigned to school', { userId, schoolId });
  return user as UserProfile;
}

export async function getSchools(
  params: GetSchoolsInput,
): Promise<PaginatedSchools> {
  const { cursor, limit = 20 } = params;

  let query = supabaseAdmin
    .from('schools')
    .select('id, name, address, phone, logo_url, is_active, created_at, classes(id, name, grade)')
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  if (cursor) {
    try {
      const decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString());
      query = query.or(
        `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
      );
    } catch {
      throw new AppError('Invalid cursor', 400, 'INVALID_CURSOR');
    }
  }

  const { data: schools, error } = await query;

  if (error) {
    logger.error('Failed to fetch schools', { error: error.message });
    throw new AppError('Failed to fetch schools', 500, 'QUERY_FAILED');
  }

  const hasNext = (schools?.length ?? 0) > limit;
  const rawResults = schools?.slice(0, limit) ?? [];

  // Two batched queries rather than two per school. Previously this issued
  // 2N+1 queries — for a 20-school page, 41 round trips. (G-34)
  const schoolIds = rawResults.map((s: { id: string }) => s.id);

  const [studentRows, teacherRows] = await Promise.all([
    supabaseAdmin.from('students').select('school_id').in('school_id', schoolIds),
    supabaseAdmin
      .from('profiles')
      .select('school_id')
      .in('school_id', schoolIds)
      .eq('role', 'teacher'),
  ]);

  const tally = (rows: { school_id: string | null }[] | null) => {
    const counts = new Map<string, number>();
    for (const row of rows ?? []) {
      if (row.school_id) counts.set(row.school_id, (counts.get(row.school_id) ?? 0) + 1);
    }
    return counts;
  };
  const studentCounts = tally(studentRows.data);
  const teacherCounts = tally(teacherRows.data);

  const enrichedResults = rawResults.map((school: any) => ({
    id: school.id,
    name: school.name,
    address: school.address,
    phone: school.phone,
    logo_url: school.logo_url,
    is_active: school.is_active ?? true,
    created_at: school.created_at,
    _count: {
      classes: school.classes?.length ?? 0,
      students: studentCounts.get(school.id) ?? 0,
      teachers: teacherCounts.get(school.id) ?? 0,
    },
    classes: (school.classes ?? []).map((c: any) => ({ id: c.id, name: c.name, grade: c.grade })),
  }));

  const nextCursor =
    hasNext && enrichedResults.length > 0
      ? Buffer.from(
          JSON.stringify({
            createdAt: enrichedResults[enrichedResults.length - 1].created_at,
            id: enrichedResults[enrichedResults.length - 1].id,
          }),
        ).toString('base64url')
      : null;

  return { schools: enrichedResults, nextCursor };
}

export async function createSchool(
  data: CreateSchoolInput,
): Promise<School> {
  const school = {
    id: uuidv4(),
    name: data.name,
    address: data.address ?? null,
    phone: data.phone ?? null,
    logo_url: data.logoUrl ?? null,
  };

  const { data: created, error } = await supabaseAdmin
    .from('schools')
    .insert(school)
    .select('id, name, address, phone, logo_url, created_at')
    .single();

  if (error) {
    logger.error('Failed to create school', {
      error: error.message,
      name: data.name,
    });
    throw new AppError('Failed to create school', 500, 'INSERT_FAILED');
  }

  logger.info('School created', { schoolId: school.id, name: data.name });
  return created as School;
}

// ---------------------------------------------------------------------------
// Class detail & teacher assignment
// ---------------------------------------------------------------------------

interface ClassDetail {
  id: string;
  name: string;
  grade: string | null;
  school_id: string;
  academic_year: string | null;
  teacher: { id: string; full_name: string; email: string } | null;
  students: Array<{
    id: string;
    full_name: string;
    date_of_birth: string | null;
    avatar_url: string | null;
    parent_count: number;
  }>;
}

export async function getClassDetail(classId: string): Promise<ClassDetail> {
  const { data: cls, error: clsError } = await supabaseAdmin
    .from('classes')
    .select('id, name, grade, school_id, academic_year, teacher_id')
    .eq('id', classId)
    .single();

  if (clsError || !cls) {
    throw new AppError('Class not found', 404, 'CLASS_NOT_FOUND');
  }

  // Fetch teacher profile if assigned
  let teacher: ClassDetail['teacher'] = null;
  if (cls.teacher_id) {
    const { data: t } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email')
      .eq('id', cls.teacher_id)
      .single();
    if (t) teacher = t as ClassDetail['teacher'];
  }

  // Fetch students in this class
  const { data: students, error: studError } = await supabaseAdmin
    .from('students')
    .select('id, full_name, date_of_birth, avatar_url')
    .eq('class_id', classId)
    .eq('is_active', true)
    .order('full_name');

  if (studError) {
    logger.error('Failed to fetch students', { error: studError.message });
    throw new AppError('Failed to fetch students', 500, 'QUERY_FAILED');
  }

  // Count parents per student
  const studentIds = (students ?? []).map((s) => s.id);
  const parentCounts: Record<string, number> = {};
  if (studentIds.length > 0) {
    const { data: mappings } = await supabaseAdmin
      .from('parent_student_mappings')
      .select('student_id')
      .in('student_id', studentIds);

    if (mappings) {
      for (const m of mappings) {
        parentCounts[m.student_id] = (parentCounts[m.student_id] ?? 0) + 1;
      }
    }
  }

  return {
    id: cls.id,
    name: cls.name,
    grade: cls.grade,
    school_id: cls.school_id,
    academic_year: cls.academic_year,
    teacher,
    students: (students ?? []).map((s) => ({
      ...s,
      parent_count: parentCounts[s.id] ?? 0,
    })),
  };
}

export async function assignTeacher(
  classId: string,
  teacherId: string | null,
): Promise<void> {
  if (teacherId) {
    // Verify teacher exists and has teacher role
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', teacherId)
      .single();

    if (!profile || profile.role !== 'teacher') {
      throw new AppError('Teacher not found', 404, 'TEACHER_NOT_FOUND');
    }
  }

  const { error } = await supabaseAdmin
    .from('classes')
    .update({ teacher_id: teacherId })
    .eq('id', classId);

  if (error) {
    logger.error('Failed to assign teacher', { error: error.message, classId, teacherId });
    throw new AppError('Failed to assign teacher', 500, 'UPDATE_FAILED');
  }

  logger.info('Teacher assigned', { classId, teacherId });
}

// ---------------------------------------------------------------------------
// Student management
// ---------------------------------------------------------------------------

export async function createStudent(data: CreateStudentInput) {
  const student = {
    id: uuidv4(),
    full_name: data.fullName,
    school_id: data.schoolId,
    class_id: data.classId ?? null,
    date_of_birth: data.dateOfBirth ?? null,
  };

  const { data: created, error } = await supabaseAdmin
    .from('students')
    .insert(student)
    .select('id, full_name, school_id, class_id, date_of_birth, avatar_url')
    .single();

  if (error) {
    logger.error('Failed to create student', { error: error.message });
    throw new AppError('Failed to create student', 500, 'INSERT_FAILED');
  }

  logger.info('Student created', { studentId: student.id });
  return created;
}

export async function removeStudentFromClass(
  classId: string,
  studentId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('students')
    .update({ class_id: null })
    .eq('id', studentId)
    .eq('class_id', classId);

  if (error) {
    logger.error('Failed to remove student from class', { error: error.message });
    throw new AppError('Failed to remove student', 500, 'UPDATE_FAILED');
  }

  logger.info('Student removed from class', { classId, studentId });
}

// ---------------------------------------------------------------------------
// Parent-student mapping
// ---------------------------------------------------------------------------

interface StudentParent {
  id: string;
  parent_id: string;
  full_name: string;
  email: string;
  relationship: string;
}

export async function getStudentParents(
  studentId: string,
): Promise<StudentParent[]> {
  const { data, error } = await supabaseAdmin
    .from('parent_student_mappings')
    .select('id, parent_id, relationship, profiles!parent_student_mappings_parent_id_fkey(full_name, email)')
    .eq('student_id', studentId);

  if (error) {
    logger.error('Failed to fetch student parents', { error: error.message });
    throw new AppError('Failed to fetch parents', 500, 'QUERY_FAILED');
  }

  return (data ?? []).map((row: any) => ({
    id: row.id,
    parent_id: row.parent_id,
    full_name: row.profiles?.full_name ?? '',
    email: row.profiles?.email ?? '',
    relationship: row.relationship,
  }));
}

export async function mapParentToStudent(
  studentId: string,
  input: MapParentInput,
): Promise<void> {
  // Look up parent profile by email
  const { data: parent, error: lookupError } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('email', input.email)
    .single();

  if (lookupError || !parent) {
    throw new AppError(
      `No user found with email "${input.email}". The parent must sign up first.`,
      404,
      'PARENT_NOT_FOUND',
    );
  }

  // Insert mapping (unique constraint prevents duplicates)
  const { error: insertError } = await supabaseAdmin
    .from('parent_student_mappings')
    .insert({
      parent_id: parent.id,
      student_id: studentId,
      relationship: input.relationship,
    });

  if (insertError) {
    if (insertError.code === '23505') {
      throw new AppError('This parent is already mapped to this student', 409, 'DUPLICATE_MAPPING');
    }
    logger.error('Failed to map parent', { error: insertError.message });
    throw new AppError('Failed to map parent', 500, 'INSERT_FAILED');
  }

  logger.info('Parent mapped to student', { parentId: parent.id, studentId });
}

export async function removeParentMapping(
  studentId: string,
  parentId: string,
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('parent_student_mappings')
    .delete()
    .eq('parent_id', parentId)
    .eq('student_id', studentId);

  if (error) {
    logger.error('Failed to remove parent mapping', { error: error.message });
    throw new AppError('Failed to remove mapping', 500, 'DELETE_FAILED');
  }

  logger.info('Parent mapping removed', { parentId, studentId });
}

// ---------------------------------------------------------------------------
// Teachers list (for assignment dropdown)
// ---------------------------------------------------------------------------

export async function getTeachers(schoolId?: string) {
  let query = supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, school_id')
    .eq('role', 'teacher')
    .eq('is_active', true)
    .order('full_name');

  if (schoolId) {
    query = query.eq('school_id', schoolId);
  }

  const { data, error } = await query;

  if (error) {
    logger.error('Failed to fetch teachers', { error: error.message });
    throw new AppError('Failed to fetch teachers', 500, 'QUERY_FAILED');
  }

  return data ?? [];
}
