import { z } from 'zod';

/**
 * Body of PATCH /me.
 *
 * Deliberately narrow. `role` and `school_id` are not here and must never be:
 * they decide what the caller can see, and a self-service endpoint that
 * accepted them would be a privilege escalation in one request. Both stay
 * behind `PATCH /admin/users/:id/role` and `/school`, which carry
 * `roleGuard('admin')`.
 *
 * `email` is also absent — it is the login identity and lives in Supabase
 * Auth, not in `profiles`. Changing it needs a verification round-trip that
 * this endpoint does not do.
 *
 * The phone regex matches `createSchoolSchema`'s, so the two disagree about
 * nothing. `null` clears the field; omitting it leaves it alone.
 */
export const updateProfileSchema = z
  .object({
    fullName: z
      .string()
      .min(1, 'Name cannot be empty')
      .max(200, 'Name too long')
      .optional(),
    phone: z
      .string()
      .regex(/^\+?[\d\s\-()]{7,20}$/, 'Invalid phone number format')
      .nullable()
      .optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
