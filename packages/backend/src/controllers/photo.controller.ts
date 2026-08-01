import { Request, Response, NextFunction } from 'express';
import * as photoService from '../services/photo.service';
import { AppError } from '../middleware/errorHandler';
import { success, paginated } from '../utils/apiResponse';
import type { RequestUploadInput, TagStudentsInput, GetPhotosInput } from '../validators/photo.validator';

export async function requestUpload(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;
    const data = req.body as RequestUploadInput;

    const result = await photoService.requestUpload(userId, data);

    res.status(201).json(success(result, 'Upload URL generated'));
  } catch (err) {
    next(err);
  }
}

export async function uploadFile(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;

    if (!req.file) {
      throw new AppError('No file provided', 400, 'NO_FILE');
    }

    await photoService.saveUploadedFile(id, req.file.path, req.user!);

    res.json(success(null, 'File uploaded and confirmed'));
  } catch (err) {
    next(err);
  }
}

export async function confirmUpload(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;

    await photoService.confirmUpload(id, req.user!);

    res.json(success(null, 'Upload confirmed, processing started'));
  } catch (err) {
    next(err);
  }
}

export async function tagStudents(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params;
    const { studentIds } = req.body as Pick<TagStudentsInput, 'studentIds'>;

    await photoService.tagStudents(id, studentIds, req.user!);

    res.json(success(null, 'Students tagged successfully'));
  } catch (err) {
    next(err);
  }
}

export async function getPhotos(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const query = req.query as unknown as GetPhotosInput;

    if (!query.classId) {
      throw new AppError(
        'classId query parameter is required',
        400,
        'VALIDATION_ERROR',
      );
    }

    const result = await photoService.getPhotosByClass(
      query.classId,
      query.cursor,
      query.limit,
      { role: req.user!.role, schoolId: req.user!.schoolId },
    );

    res.json(paginated(result.photos, result.nextCursor));
  } catch (err) {
    next(err);
  }
}
