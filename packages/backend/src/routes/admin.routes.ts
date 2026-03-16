import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import {
  createSchoolSchema,
  updateUserRoleSchema,
  assignUserToSchoolSchema,
  getUsersSchema,
  getSchoolsSchema,
  assignTeacherSchema,
  createStudentSchema,
  mapParentSchema,
} from '../validators/admin.validator';
import * as adminController from '../controllers/admin.controller';

const router: import("express").Router = Router();

// All admin routes require authentication + admin role
router.use(authenticate);
router.use(roleGuard('admin'));

// GET /admin/dashboard - Dashboard statistics
router.get('/dashboard', adminController.getDashboardStats);

// GET /admin/users - List users with search/filter
router.get(
  '/users',
  validate(getUsersSchema, 'query'),
  adminController.getUsers,
);

// PATCH /admin/users/:id/role - Update user role
router.patch(
  '/users/:id/role',
  validate(updateUserRoleSchema, 'body'),
  adminController.updateUserRole,
);

// PATCH /admin/users/:id/school - Assign user to school
router.patch(
  '/users/:id/school',
  validate(assignUserToSchoolSchema, 'body'),
  adminController.assignUserToSchool,
);

// GET /admin/schools - List schools
router.get(
  '/schools',
  validate(getSchoolsSchema, 'query'),
  adminController.getSchools,
);

// POST /admin/schools - Create school
router.post(
  '/schools',
  validate(createSchoolSchema, 'body'),
  adminController.createSchool,
);

// ── Class detail & teacher assignment ──────────────────────────────────

// GET /admin/classes/:classId - Class detail with students and teacher
router.get('/classes/:classId', adminController.getClassDetail);

// PATCH /admin/classes/:classId/teacher - Assign/unassign teacher
router.patch(
  '/classes/:classId/teacher',
  validate(assignTeacherSchema, 'body'),
  adminController.assignTeacher,
);

// POST /admin/classes/:classId/students - Add student to class
router.post(
  '/classes/:classId/students',
  validate(createStudentSchema, 'body'),
  adminController.addStudentToClass,
);

// DELETE /admin/classes/:classId/students/:studentId - Remove student from class
router.delete(
  '/classes/:classId/students/:studentId',
  adminController.removeStudentFromClass,
);

// ── Student management ─────────────────────────────────────────────────

// POST /admin/students - Create a new student
router.post(
  '/students',
  validate(createStudentSchema, 'body'),
  adminController.createStudent,
);

// ── Parent-student mapping ─────────────────────────────────────────────

// GET /admin/students/:studentId/parents - List parents for a student
router.get('/students/:studentId/parents', adminController.getStudentParents);

// POST /admin/students/:studentId/parents - Map parent by email
router.post(
  '/students/:studentId/parents',
  validate(mapParentSchema, 'body'),
  adminController.mapParentToStudent,
);

// DELETE /admin/students/:studentId/parents/:parentId - Remove mapping
router.delete(
  '/students/:studentId/parents/:parentId',
  adminController.removeParentMapping,
);

// ── Teachers list ──────────────────────────────────────────────────────

// GET /admin/teachers - List teachers (for assignment dropdowns)
router.get('/teachers', adminController.getTeachers);

export default router;
