import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import {
  createSchoolSchema,
  updateSchoolSchema,
  updateUserRoleSchema,
  assignUserToSchoolSchema,
  getUsersSchema,
  getSchoolsSchema,
  assignTeacherSchema,
  createStudentSchema,
  mapParentSchema,
} from '../validators/admin.validator';
import {
  getSchoolOrdersSchema,
  updateOrderStatusSchema,
} from '../validators/order.validator';
import {
  uuidIdParam,
  uuidClassIdParam,
  uuidStudentIdParam,
  uuidClassAndStudentParams,
  uuidStudentAndParentParams,
} from '../validators/params.validator';
import * as adminController from '../controllers/admin.controller';
import * as orderController from '../controllers/order.controller';

const router: import("express").Router = Router();

// All admin routes require authentication + admin role
router.use(authenticate);
router.use(roleGuard('admin'));

// GET /admin/dashboard - Dashboard statistics
router.get('/dashboard', adminController.getDashboardStats);

// GET /admin/orders - Fulfilment queue for a school
router.get(
  '/orders',
  validate(getSchoolOrdersSchema, 'query'),
  orderController.getSchoolOrders,
);

// PATCH /admin/orders/:id/status - Advance an order through fulfilment
router.patch(
  '/orders/:id/status',
  validate(uuidIdParam, 'params'),
  validate(updateOrderStatusSchema, 'body'),
  orderController.updateOrderStatus,
);

// GET /admin/users - List users with search/filter
router.get(
  '/users',
  validate(getUsersSchema, 'query'),
  adminController.getUsers,
);

// PATCH /admin/users/:id/role - Update user role
router.patch(
  '/users/:id/role',
  validate(uuidIdParam, 'params'),
  validate(updateUserRoleSchema, 'body'),
  adminController.updateUserRole,
);

// PATCH /admin/users/:id/school - Assign user to school
router.patch(
  '/users/:id/school',
  validate(uuidIdParam, 'params'),
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

// PATCH /admin/schools/:id - Update school details
router.patch(
  '/schools/:id',
  validate(uuidIdParam, 'params'),
  validate(updateSchoolSchema, 'body'),
  adminController.updateSchool,
);

// ── Class detail & teacher assignment ──────────────────────────────────

// GET /admin/classes/:classId - Class detail with students and teacher
router.get(
  '/classes/:classId',
  validate(uuidClassIdParam, 'params'),
  adminController.getClassDetail,
);

// PATCH /admin/classes/:classId/teacher - Assign/unassign teacher
router.patch(
  '/classes/:classId/teacher',
  validate(uuidClassIdParam, 'params'),
  validate(assignTeacherSchema, 'body'),
  adminController.assignTeacher,
);

// POST /admin/classes/:classId/students - Add student to class
router.post(
  '/classes/:classId/students',
  validate(uuidClassIdParam, 'params'),
  validate(createStudentSchema, 'body'),
  adminController.addStudentToClass,
);

// DELETE /admin/classes/:classId/students/:studentId - Remove student from class
router.delete(
  '/classes/:classId/students/:studentId',
  validate(uuidClassAndStudentParams, 'params'),
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
router.get(
  '/students/:studentId/parents',
  validate(uuidStudentIdParam, 'params'),
  adminController.getStudentParents,
);

// POST /admin/students/:studentId/parents - Map parent by email
router.post(
  '/students/:studentId/parents',
  validate(uuidStudentIdParam, 'params'),
  validate(mapParentSchema, 'body'),
  adminController.mapParentToStudent,
);

// DELETE /admin/students/:studentId/parents/:parentId - Remove mapping
router.delete(
  '/students/:studentId/parents/:parentId',
  validate(uuidStudentAndParentParams, 'params'),
  adminController.removeParentMapping,
);

// ── Teachers list ──────────────────────────────────────────────────────

// GET /admin/teachers - List teachers (for assignment dropdowns)
router.get('/teachers', adminController.getTeachers);

export default router;
