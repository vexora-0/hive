import { Request, Response, NextFunction } from 'express';
import * as feedService from '../services/feed.service';
import { paginated, success } from '../utils/apiResponse';

export async function getFeed(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { studentId, cursor, limit } = req.query as {
      studentId?: string;
      cursor?: string;
      limit?: string;
    };

    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    const clampedLimit = Math.min(Math.max(parsedLimit || 20, 1), 50);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const result = await feedService.getFeed(
      userId,
      studentId,
      cursor,
      clampedLimit,
      baseUrl,
    );

    res.json(paginated(result.photos, result.nextCursor));
  } catch (err) {
    next(err);
  }
}

export async function getPhotoDetails(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const photo = await feedService.getPhotoDetails(id, userId, baseUrl);

    res.json(success(photo));
  } catch (err) {
    next(err);
  }
}
