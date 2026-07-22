import { Request, Response, NextFunction } from 'express';

import * as schoolService from '../services/school.service';
import { success } from '../utils/apiResponse';
import type { CreateClassInput } from '../validators/school.validator';

export async function listClasses(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await schoolService.listClasses(req.params.id, req.user);
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function listStudents(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const classId = req.query.classId as string | undefined;
    const data = await schoolService.listStudents(
      req.params.id,
      req.user,
      classId,
    );
    res.json(success(data));
  } catch (err) {
    next(err);
  }
}

export async function createClass(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const data = await schoolService.createClass(
      req.params.id,
      req.body as CreateClassInput,
      req.user,
    );
    res.status(201).json(success(data, 'Class created'));
  } catch (err) {
    next(err);
  }
}
