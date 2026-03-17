import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { roleGuard } from '../middleware/roleGuard';
import { validate } from '../middleware/validate';
import { supabaseAdmin } from '../config/supabase';
import { success } from '../utils/apiResponse';
import { z } from 'zod';

const router: import("express").Router = Router();

const createClassSchema = z.object({
  name: z.string().min(1),
  grade: z.string().optional(),
  academicYear: z.string().optional(),
});

// GET /schools/:id/classes - list classes for a school
router.get(
  '/:id/classes',
  authenticate,
  roleGuard('teacher', 'admin'),
  async (req, res, next) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('classes')
        .select('id, name, grade, teacher_id, academic_year, is_active')
        .eq('school_id', req.params.id)
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  },
);

// GET /schools/:id/students - list students for a school
router.get(
  '/:id/students',
  authenticate,
  roleGuard('teacher', 'admin'),
  async (req, res, next) => {
    try {
      const { classId } = req.query;
      let query = supabaseAdmin
        .from('students')
        .select('id, full_name, class_id, avatar_url, date_of_birth')
        .eq('school_id', req.params.id)
        .eq('is_active', true)
        .order('full_name');

      if (classId) query = query.eq('class_id', classId as string);

      const { data, error } = await query;
      if (error) throw error;
      res.json(success(data));
    } catch (err) {
      next(err);
    }
  },
);

// POST /schools/:id/classes - create a class (admin only)
router.post(
  '/:id/classes',
  authenticate,
  roleGuard('admin'),
  validate(createClassSchema, 'body'),
  async (req, res, next) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('classes')
        .insert({
          school_id: req.params.id,
          name: req.body.name,
          grade: req.body.grade,
          academic_year: req.body.academicYear,
        })
        .select()
        .single();

      if (error) throw error;
      res.status(201).json(success(data, 'Class created'));
    } catch (err) {
      next(err);
    }
  },
);

export default router;
