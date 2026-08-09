import { z } from 'zod';

/**
 * `PATCH /notifications/read-all` takes no input at all — the set of rows it
 * touches is "everything unread belonging to the caller", and the caller comes
 * from the bearer token.
 *
 * The body is still validated, as strictly empty, rather than left unchecked.
 * The obvious way to misuse this endpoint is to send `{ "user_id": "…" }` and
 * expect it to be honoured; `.strict()` answers that with a 400 naming the
 * unrecognised key, where an unvalidated body would accept it, ignore it, and
 * return 200 — leaving the caller believing it had cleared someone else's
 * inbox.
 */
export const markAllReadBody = z.object({}).strict();
