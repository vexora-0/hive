import { Request, Response, NextFunction } from 'express';
import * as adminService from '../services/admin.service';
import { success, paginated } from '../utils/apiResponse';
import type {
  CreateSchoolInput,
  UpdateSchoolInput,
  CreateStudentInput,
  MapParentInput,
  UpdateUserRoleInput,
  GetUsersInput,
  GetSchoolsInput,
  AssignTeacherInput,
  AssignUserToSchoolInput,
} from '../validators/admin.validator';

export async function getDashboardStats(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const stats = await adminService.getDashboardStats();
    res.json(success(stats));
  } catch (err) {
    next(err);
  }
}

export async function getUsers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = req.query as unknown as GetUsersInput;
    const result = await adminService.getUsers(query);
    res.json(paginated(result.users, result.nextCursor));
  } catch (err) {
    next(err);
  }
}

export async function updateUserRole(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const { role } = req.body as UpdateUserRoleInput;

    const user = await adminService.updateUserRole(id, role);
    res.json(success(user, 'User role updated'));
  } catch (err) {
    next(err);
  }
}

export async function assignUserToSchool(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const { schoolId } = req.body as AssignUserToSchoolInput;
    const user = await adminService.assignUserToSchool(id, schoolId);
    res.json(success(user, 'User assigned to school'));
  } catch (err) {
    next(err);
  }
}

export async function getSchools(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = req.query as unknown as GetSchoolsInput;
    const result = await adminService.getSchools(query);
    res.json(paginated(result.schools, result.nextCursor));
  } catch (err) {
    next(err);
  }
}

export async function createSchool(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = req.body as CreateSchoolInput;
    const school = await adminService.createSchool(data);
    res.status(201).json(success(school, 'School created'));
  } catch (err) {
    next(err);
  }
}

export async function updateSchool(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const data = req.body as UpdateSchoolInput;
    const school = await adminService.updateSchool(id, data);
    res.json(success(school, 'School updated'));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Class detail & teacher assignment
// ---------------------------------------------------------------------------

export async function getClassDetail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const detail = await adminService.getClassDetail(req.params.classId);
    res.json(success(detail));
  } catch (err) {
    next(err);
  }
}

export async function assignTeacher(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { teacherId } = req.body as AssignTeacherInput;
    await adminService.assignTeacher(req.params.classId, teacherId);
    res.json(success(null, 'Teacher assigned'));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Student management
// ---------------------------------------------------------------------------

export async function createStudent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = req.body as CreateStudentInput;
    const student = await adminService.createStudent(data);
    res.status(201).json(success(student, 'Student created'));
  } catch (err) {
    next(err);
  }
}

export async function addStudentToClass(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = req.body as CreateStudentInput;
    // Override classId with the route param
    data.classId = req.params.classId;
    const student = await adminService.createStudent(data);
    res.status(201).json(success(student, 'Student added to class'));
  } catch (err) {
    next(err);
  }
}

export async function removeStudentFromClass(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await adminService.removeStudentFromClass(
      req.params.classId,
      req.params.studentId,
    );
    res.json(success(null, 'Student removed from class'));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Parent-student mapping
// ---------------------------------------------------------------------------

export async function getStudentParents(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const parents = await adminService.getStudentParents(req.params.studentId);
    res.json(success(parents));
  } catch (err) {
    next(err);
  }
}

export async function mapParentToStudent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const input = req.body as MapParentInput;
    await adminService.mapParentToStudent(req.params.studentId, input);
    res.status(201).json(success(null, 'Parent mapped to student'));
  } catch (err) {
    next(err);
  }
}

export async function removeParentMapping(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await adminService.removeParentMapping(
      req.params.studentId,
      req.params.parentId,
    );
    res.json(success(null, 'Parent mapping removed'));
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Teachers list
// ---------------------------------------------------------------------------

export async function getTeachers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const schoolId = req.query.schoolId as string | undefined;
    const teachers = await adminService.getTeachers(schoolId);
    res.json(success(teachers));
  } catch (err) {
    next(err);
  }
}
