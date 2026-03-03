import { apiRequest } from '@/lib/api';
import type { UserRole, Tables } from '@/types/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardStats {
  schools: number;
  users: number;
  photos: number;
  orders: number;
  revenue: number;
  activeToday: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  nextCursor: string | null;
  total: number;
}

export interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  school_id: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AdminSchool {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
  _count: {
    classes: number;
    students: number;
    teachers: number;
  };
  classes: Array<{ id: string; name: string; grade: string | null }>;
}

export interface CreateSchoolData {
  name: string;
  address?: string;
  phone?: string;
}

export interface CreateClassData {
  name: string;
  grade?: string;
  academicYear?: string;
}

export interface ClassDetail {
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

export interface StudentParent {
  id: string;
  parent_id: string;
  full_name: string;
  email: string;
  relationship: string;
}

export interface TeacherOption {
  id: string;
  full_name: string;
  email: string;
  school_id: string | null;
}

export interface CreateStudentData {
  fullName: string;
  schoolId: string;
  classId?: string;
  dateOfBirth?: string;
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * Fetch aggregate dashboard statistics for the admin overview.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await apiRequest<{
    success: true;
    data: {
      totalSchools: number;
      totalUsers: number;
      totalPhotos: number;
      totalOrders: number;
      totalRevenue: number;
    };
  }>('/admin/dashboard', { method: 'GET' });

  return {
    schools: res.data.totalSchools,
    users: res.data.totalUsers,
    photos: res.data.totalPhotos,
    orders: res.data.totalOrders,
    revenue: res.data.totalRevenue,
    activeToday: 0,
  };
}

/**
 * Fetch a paginated, searchable, filterable list of users.
 */
export async function getUsers(
  search?: string,
  role?: UserRole,
  cursor?: string,
  limit: number = 20,
): Promise<PaginatedResponse<AdminUser>> {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (role) params.set('role', role);
  if (cursor) params.set('cursor', cursor);
  params.set('limit', String(limit));

  const qs = params.toString();
  const res = await apiRequest<{
    success: true;
    data: AdminUser[];
    cursor: string | null;
  }>(`/admin/users?${qs}`, { method: 'GET' });

  return {
    data: res.data,
    nextCursor: res.cursor,
    total: res.data.length,
  };
}

/**
 * Update a user's role.
 */
export async function updateUserRole(
  userId: string,
  role: UserRole,
): Promise<void> {
  await apiRequest(`/admin/users/${userId}/role`, {
    method: 'PATCH',
    body: { role },
  });
}

/**
 * Assign a user to a school (or unassign by passing null).
 */
export async function assignUserToSchool(
  userId: string,
  schoolId: string | null,
): Promise<void> {
  await apiRequest(`/admin/users/${userId}/school`, {
    method: 'PATCH',
    body: { schoolId },
  });
}

/**
 * Fetch a paginated list of schools with nested counts.
 */
export async function getSchools(
  cursor?: string,
  limit: number = 20,
): Promise<PaginatedResponse<AdminSchool>> {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  params.set('limit', String(limit));

  const qs = params.toString();
  const res = await apiRequest<{
    success: true;
    data: AdminSchool[];
    cursor: string | null;
  }>(`/admin/schools?${qs}`, { method: 'GET' });

  return {
    data: res.data,
    nextCursor: res.cursor,
    total: res.data.length,
  };
}

/**
 * Create a new school.
 */
export async function createSchool(
  data: CreateSchoolData,
): Promise<Tables<'schools'>> {
  const res = await apiRequest<{ success: true; data: Tables<'schools'> }>(
    '/admin/schools',
    { method: 'POST', body: data },
  );
  return res.data;
}

/**
 * Create a new class for a school. Admin only.
 */
export async function createClass(
  schoolId: string,
  data: CreateClassData,
): Promise<{ id: string; name: string; grade: string | null; school_id: string }> {
  const res = await apiRequest<{
    success: true;
    data: { id: string; name: string; grade: string | null; school_id: string };
  }>(`/schools/${schoolId}/classes`, { method: 'POST', body: data });
  return res.data;
}

// ---------------------------------------------------------------------------
// Class detail & teacher assignment
// ---------------------------------------------------------------------------

/**
 * Fetch class detail with students and teacher info.
 */
export async function getClassDetail(classId: string): Promise<ClassDetail> {
  const res = await apiRequest<{ success: true; data: ClassDetail }>(
    `/admin/classes/${classId}`,
    { method: 'GET' },
  );
  return res.data;
}

/**
 * Assign or unassign a teacher to a class.
 */
export async function assignTeacher(
  classId: string,
  teacherId: string | null,
): Promise<void> {
  await apiRequest(`/admin/classes/${classId}/teacher`, {
    method: 'PATCH',
    body: { teacherId },
  });
}

/**
 * Add a new student to a class.
 */
export async function addStudentToClass(
  classId: string,
  data: CreateStudentData,
): Promise<void> {
  await apiRequest(`/admin/classes/${classId}/students`, {
    method: 'POST',
    body: data,
  });
}

/**
 * Remove a student from a class (unassigns, doesn't delete).
 */
export async function removeStudentFromClass(
  classId: string,
  studentId: string,
): Promise<void> {
  await apiRequest(`/admin/classes/${classId}/students/${studentId}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// Parent-student mapping
// ---------------------------------------------------------------------------

/**
 * List parents mapped to a student.
 */
export async function getStudentParents(
  studentId: string,
): Promise<StudentParent[]> {
  const res = await apiRequest<{ success: true; data: StudentParent[] }>(
    `/admin/students/${studentId}/parents`,
    { method: 'GET' },
  );
  return res.data;
}

/**
 * Map a parent to a student by email.
 */
export async function mapParentToStudent(
  studentId: string,
  email: string,
  relationship: string = 'parent',
): Promise<void> {
  await apiRequest(`/admin/students/${studentId}/parents`, {
    method: 'POST',
    body: { email, relationship },
  });
}

/**
 * Remove a parent-student mapping.
 */
export async function removeParentMapping(
  studentId: string,
  parentId: string,
): Promise<void> {
  await apiRequest(`/admin/students/${studentId}/parents/${parentId}`, {
    method: 'DELETE',
  });
}

// ---------------------------------------------------------------------------
// Teachers list
// ---------------------------------------------------------------------------

/**
 * List teachers for assignment dropdowns.
 */
export async function getTeachers(
  schoolId?: string,
): Promise<TeacherOption[]> {
  const params = schoolId ? `?schoolId=${schoolId}` : '';
  const res = await apiRequest<{ success: true; data: TeacherOption[] }>(
    `/admin/teachers${params}`,
    { method: 'GET' },
  );
  return res.data;
}
