import { Request, Response, NextFunction } from 'express';
import * as feedService from '../services/feed.service';
import type { GetFeedInput } from '../validators/feed.validator';
import { paginated, success } from '../utils/apiResponse';

export async function getFeed(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId = req.user!.id;
    // Validated and clamped by `getFeedSchema` on the route.
    const { studentId, cursor, limit } = req.query as unknown as GetFeedInput;

    const result = await feedService.getFeed(userId, studentId, cursor, limit);

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
    const { id } = req.params;
    const photo = await feedService.getPhotoDetails(id, req.user!.id);

    res.json(success(photo));
  } catch (err) {
    next(err);
  }
}
