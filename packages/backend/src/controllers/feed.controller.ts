import { Request, Response, NextFunction } from 'express';
import * as feedService from '../services/feed.service';
import type {
  GetFeedInput,
  GetDiaryInput,
  DiaryMonthParam,
} from '../validators/feed.validator';
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

/**
 * `GET /feed/diary` — the outline of a child's whole journey.
 *
 * One response covers every month the child has photographs in, however long
 * they have been at school; the months themselves are fetched one at a time by
 * `getDiaryChapter` below.
 */
export async function getDiary(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { studentId, tzOffset } = req.query as unknown as GetDiaryInput;

    const diary = await feedService.getDiary(req.user!.id, studentId, tzOffset);

    res.json(success(diary));
  } catch (err) {
    next(err);
  }
}

/** `GET /feed/diary/:month` — one month of the diary, grouped into days. */
export async function getDiaryChapter(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { month } = req.params as unknown as DiaryMonthParam;
    const { studentId, tzOffset } = req.query as unknown as GetDiaryInput;

    const chapter = await feedService.getDiaryChapter(
      req.user!.id,
      studentId,
      month,
      tzOffset,
    );

    res.json(success(chapter));
  } catch (err) {
    next(err);
  }
}
