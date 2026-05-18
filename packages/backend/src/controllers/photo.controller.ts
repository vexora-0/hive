import { Request, Response, NextFunction } from 'express';
import * as photoService from '../services/photo.service';
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
      res.status(400).json({ success: false, message: 'No file provided', code: 'NO_FILE' });
      return;
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
      res.status(400).json({
        success: false,
        message: 'classId query parameter is required',
        code: 'VALIDATION_ERROR',
      });
      return;
    }

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const result = await photoService.getPhotosByClass(
      query.classId,
      req.user!,
      query.cursor,
      query.limit,
      baseUrl,
    );

    res.json(paginated(result.photos, result.nextCursor));
  } catch (err) {
    next(err);
  }
}
