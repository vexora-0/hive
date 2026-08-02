import { Request, Response, NextFunction } from 'express';
import * as profileService from '../services/profile.service';
import { success } from '../utils/apiResponse';
import type { UpdateProfileInput } from '../validators/profile.validator';

export async function getMe(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const profile = await profileService.getProfile(req.user!.id);
    res.json(success(profile));
  } catch (err) {
    next(err);
  }
}

export async function updateMe(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    // The user ID comes from the verified token, never from the body.
    const profile = await profileService.updateProfile(
      req.user!.id,
      req.body as UpdateProfileInput,
    );
    res.json(success(profile, 'Profile updated'));
  } catch (err) {
    next(err);
  }
}
