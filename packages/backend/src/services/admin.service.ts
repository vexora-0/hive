import { v4 as uuidv4 } from 'uuid';
import { supabaseAdmin } from '../config/supabase';
import { logger } from '../config/logger';
import { AppError } from '../middleware/errorHandler';
import { decodeCursor, encodeCursor } from '../utils/cursor';
import type {
  CreateSchoolInput,
  UpdateSchoolInput,
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
  /** Integer cents. */
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
      // `ready` only. Removing a photo archives the row rather than deleting
      // it, and the teacher's own confirmation promises it "will disappear
      // from every parent's feed" — so counting archived rows reports photos
      // as shared that deliberately are not, and the figure only ever grows.
      // A `pending` upload has not been shared either. Found on a device: three
      // test photos were uploaded and removed again, and the dashboard still
      // read nine.
      supabaseAdmin
        .from('photos')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'ready'),
      // Originally selected `total`, which never existed; then `total_amount`,
      // which migration 00017 renamed to total_cents. Both times the error went
      // unchecked and the dashboard silently reported zero. It is checked below
      // now, which is how the second break was caught. (G-06)
      supabaseAdmin.from('orders').select('total_cents, status'),
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

  // Two different questions, deliberately answered differently.
  //
  // `totalOrders` counts every order, cancelled included: it is a count of what
  // happened, and an order that was placed and then cancelled did happen.
  //
  // `totalRevenue` excludes cancelled ones, because that is money the school
  // never took. Summing every row reported a cancellation as income, and the
  // figure could only ever grow — there is no path that reduces it. It reads
  // correct on the seeded data purely by luck: none of the three demo orders is
  // cancelled, so both sums agree. `PATCH /orders/:id/cancel` exists and works,
  // so the first real cancellation would have made the dashboard overstate
  // takings with nothing to indicate it.
  const orders = ordersResult.data ?? [];
  const totalOrders = orders.length;
  const totalRevenue = orders
    .filter((order) => order.status !== 'cancelled')
    .reduce((sum, order) => sum + Number(order.total_cents ?? 0), 0);

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
    const decoded = decodeCursor(cursor);
    query = query.or(
      `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
    );
  }

  const { data: users, error } = await query;

  if (error) {
    logger.error('Failed to fetch users', { error: error.message });
    throw new AppError('Failed to fetch users', 500, 'QUERY_FAILED');
  }

  const hasNext = (users?.length ?? 0) > limit;
  const results = (users?.slice(0, limit) ?? []) as UserProfile[];

  const last = results[results.length - 1];
  const nextCursor =
    hasNext && results.length > 0 ? encodeCursor(last.created_at, last.id) : null;

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
    const decoded = decodeCursor(cursor);
    query = query.or(
      `created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
    );
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

  // Neither result's error was read, so a failed count query silently became
  // "0 students, 0 teachers" — a plausible number that is indistinguishable
  // from the truth. This endpoint has already shipped that class of bug twice.
  if (studentRows.error || teacherRows.error) {
    logger.error('Failed to count school members', {
      studentError: studentRows.error?.message,
      teacherError: teacherRows.error?.message,
    });
    throw new AppError('Failed to fetch schools', 500, 'QUERY_FAILED');
  }

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

  const last = enrichedResults[enrichedResults.length - 1];
  const nextCursor =
    hasNext && enrichedResults.length > 0 ? encodeCursor(last.created_at, last.id) : null;

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

/**
 * Update a school's details.
 *
 * `updateSchoolSchema` has existed since the validators were written and no
 * route ever used it — a school's name or address could be set once at
 * creation and never corrected. (M-9)
 *
 * `email` is accepted by the schema but the `schools` table has no such
 * column, so it is dropped here exactly as `createSchool` drops it. Every
 * field is optional, so only what was sent is written.
 */
export async function updateSchool(
  schoolId: string,
  data: UpdateSchoolInput,
): Promise<School> {
  const patch: Record<string, string | null> = {};
  if (data.name !== undefined) patch.name = data.name;
  if (data.address !== undefined) patch.address = data.address;
  if (data.phone !== undefined) patch.phone = data.phone;
  if (data.logoUrl !== undefined) patch.logo_url = data.logoUrl;

  if (Object.keys(patch).length === 0) {
    throw new AppError('No fields to update', 400, 'NO_FIELDS');
  }

  patch.updated_at = new Date().toISOString();

  const { data: updated, error } = await supabaseAdmin
    .from('schools')
    .update(patch)
    .eq('id', schoolId)
    .select('id, name, address, phone, logo_url, created_at')
    .maybeSingle();

  if (error) {
    logger.error('Failed to update school', { error: error.message, schoolId });
    throw new AppError('Failed to update school', 500, 'UPDATE_FAILED');
  }

  // maybeSingle returns null rather than erroring when nothing matched, which
  // is the difference between "no such school" (404) and a real failure (500).
  if (!updated) {
    throw new AppError('School not found', 404, 'SCHOOL_NOT_FOUND');
  }

  logger.info('School updated', { schoolId, fields: Object.keys(patch) });
  return updated as School;
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

    // A teacher may only run a class at their own school. Without this an
    // admin could put a teacher in front of another school's children — and
    // the class roster, with dates of birth, comes with it.
    const { data: klass } = await supabaseAdmin
      .from('classes')
      .select('school_id')
      .eq('id', classId)
      .single();

    if (!klass) {
      throw new AppError('Class not found', 404, 'CLASS_NOT_FOUND');
    }

    const { data: teacherProfile } = await supabaseAdmin
      .from('profiles')
      .select('school_id')
      .eq('id', teacherId)
      .single();

    if (teacherProfile?.school_id !== klass.school_id) {
      throw new AppError(
        'That teacher belongs to a different school',
        400,
        'SCHOOL_MISMATCH',
      );
    }
  }

  // `count`, not just `error`: an update matching no rows is not an error in
  // PostgREST, so a nonexistent classId used to return "Teacher assigned"
  // having changed nothing.
  const { error, count } = await supabaseAdmin
    .from('classes')
    .update({ teacher_id: teacherId }, { count: 'exact' })
    .eq('id', classId);

  if (error) {
    logger.error('Failed to assign teacher', { error: error.message, classId, teacherId });
    throw new AppError('Failed to assign teacher', 500, 'UPDATE_FAILED');
  }

  if (!count) {
    throw new AppError('Class not found', 404, 'CLASS_NOT_FOUND');
  }

  logger.info('Teacher assigned', { classId, teacherId });
}

// ---------------------------------------------------------------------------
// Student management
// ---------------------------------------------------------------------------

export async function createStudent(data: CreateStudentInput) {
  // The class and the school arrive from different places — `schoolId` from the
  // body, `classId` from the route param on the add-to-class endpoint — and
  // nothing checked they agreed. A mismatch is silent but live: the roster is
  // filtered by school_id, so the child never appears in their own teacher's
  // list, and tagging them in their own class's photos is refused as an
  // invalid student.
  if (data.classId) {
    const { data: klass } = await supabaseAdmin
      .from('classes')
      .select('school_id')
      .eq('id', data.classId)
      .single();

    if (!klass) {
      throw new AppError('Class not found', 404, 'CLASS_NOT_FOUND');
    }

    if (klass.school_id !== data.schoolId) {
      throw new AppError(
        'That class belongs to a different school',
        400,
        'SCHOOL_MISMATCH',
      );
    }
  }

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
  // Both filters must match, so zero rows means the student is not in that
  // class — which the caller asked to change and must be told about, rather
  // than being sent a 200 for work that did not happen.
  const { error, count } = await supabaseAdmin
    .from('students')
    .update({ class_id: null }, { count: 'exact' })
    .eq('id', studentId)
    .eq('class_id', classId);

  if (error) {
    logger.error('Failed to remove student from class', { error: error.message });
    throw new AppError('Failed to remove student', 500, 'UPDATE_FAILED');
  }

  if (!count) {
    throw new AppError(
      'That student is not in this class',
      404,
      'STUDENT_NOT_IN_CLASS',
    );
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
    .select('id, role, school_id')
    .eq('email', input.email)
    .single();

  if (lookupError || !parent) {
    throw new AppError(
      `No user found with email "${input.email}". The parent must sign up first.`,
      404,
      'PARENT_NOT_FOUND',
    );
  }

  // The role was already being fetched here and then ignored. Mapping a teacher
  // or an admin account to a student would hand it that child's photo feed,
  // which is scoped by parent_student_mappings alone.
  if (parent.role !== 'parent') {
    throw new AppError(
      `"${input.email}" is a ${parent.role} account, not a parent`,
      400,
      'NOT_A_PARENT',
    );
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from('students')
    .select('school_id')
    .eq('id', studentId)
    .single();

  if (studentError || !student) {
    throw new AppError('Student not found', 404, 'STUDENT_NOT_FOUND');
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

  // A parent signs up with no school — the signup trigger (migration 00014)
  // cannot know one — and `createOrder` refuses anyone without a school_id. So
  // a linked parent could see their child's photos but never order a print.
  // Being linked to a student is exactly what establishes which school they
  // belong to. Only filled when absent, so a parent with children at two
  // schools keeps the school they were first attached to.
  if (!parent.school_id) {
    const { error: schoolError } = await supabaseAdmin
      .from('profiles')
      .update({ school_id: student.school_id })
      .eq('id', parent.id)
      .is('school_id', null);

    if (schoolError) {
      // The mapping itself succeeded, so this is not fatal to the request.
      logger.error('Failed to set parent school from mapping', {
        parentId: parent.id,
        error: schoolError.message,
      });
    }
  }

  logger.info('Parent mapped to student', { parentId: parent.id, studentId });
}

export async function removeParentMapping(
  studentId: string,
  parentId: string,
): Promise<void> {
  const { error, count } = await supabaseAdmin
    .from('parent_student_mappings')
    .delete({ count: 'exact' })
    .eq('parent_id', parentId)
    .eq('student_id', studentId);

  if (error) {
    logger.error('Failed to remove parent mapping', { error: error.message });
    throw new AppError('Failed to remove mapping', 500, 'DELETE_FAILED');
  }

  // Revoking access is exactly the operation where "it said it worked" must
  // mean it worked: a silent no-op leaves the parent still able to see the
  // child's photos while the console shows them unlinked.
  if (!count) {
    throw new AppError('That parent is not linked to this student', 404, 'MAPPING_NOT_FOUND');
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
